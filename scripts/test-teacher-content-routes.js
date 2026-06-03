const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { registerTeacherContentRoutes } = require('../routes/teacherContentRoutes');
const { planTeacherContentImport } = require('../lib/uploads/planTeacherContentImport');
const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');
const { loadEnabledApprovedKnowledgeItems } = require('../lib/knowledge/loadEnabledApprovedKnowledgeItems');

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
fs.mkdirSync(rawModelResponsesDir, { recursive: true });
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
    await assertUploadExtractionCleanupAndChunkMetadata(handlers);
    await assertUnsupportedUploadExtensionFails(handlers);
    await assertUnsafeUploadFilenameIsSanitized(handlers);
    await assertDraftsEndpoint(handlers);
    await assertStandardsBankListEndpoint(handlers);
    await assertStandardsBankDetailEndpoint(handlers);
    await assertInvalidStandardsBankIdRejected(handlers);
    await assertDraftReportEndpoint(handlers);
    await assertDraftReportNeedsReviewItemsAreIncluded(handlers);
    await assertDraftReportIncludesApprovedItemsBlockingPromotion(handlers);
    await assertDraftReportIncludesSalvageWarningsForAdvancedDetails(handlers);
    await assertDraftReportWithStoredCoverageAndMissingExtractionPages(handlers);
    await assertDraftReportPreservesStoredProcessedChunkCount(handlers);
    await assertDraftReportSuppressesPausedStandardsWarnings(handlers);
    await assertDraftReportWithStandardsBankEndpoint(handlers);
    await assertMissingDraftReportStandardsBankEndpoint(handlers);
    await assertPrepareReviewEndpointSucceeds(handlers);
    await assertPrepareReviewImportProfileSelection(handlers);
    await assertLargeFullImportRequiresConfirmation(handlers);
    await assertPreviewPrepareReviewDoesNotWriteDraft(handlers);
    await assertPreviewEmptyFirstPageReturnsTextPageRecovery(handlers);
    await assertUltraSafePreviewNormalizesConceptFields(handlers);
    await assertPreviewValidationFailureReturnsHttp200PartialPreview(handlers);
    await assertPartialPreviewReturnsSuccessfulItemsWithoutDraft(handlers);
    await assertPreviewPrepareReviewRequiresRange(handlers);
    await assertPrepareReviewNoUsablePreviewItemsReturnsStructuredRecoveryJson(handlers);
    await assertSelectedPageRangeImportWritesPartialDraft(handlers);
    await assertAutoPlanPrepareReviewWithoutManualMode(handlers);
    await assertLargeAnalyzeUploadAvoidsPreviewHardStop(handlers);
    await assertAutoPreviewOnlyPlanStillRunsAdaptiveAnalyze(handlers);
    await assertAnalyzeAdaptiveLoopProcessesManifestToTerminal(handlers);
    assertAutoImportPlannerSmallFileSingleBatch();
    assertAutoImportPlannerMultiPageSequentialBatches();
    assertAutoImportPlannerVeryLargeDoesNotDropTextBearingPages();
    assertAutoImportPlannerNoTextManualReview();
    assertAutoImportPlannerLowMemoryUsesAutomaticSmallerChunks();
    assertAutoImportPlannerImageOnlyWarning();
    await assertUploadAndPrepareEndpointSucceeds(handlers);
    await assertUploadAndPreparePdfWithKnowledgeNameSucceeds(handlers);
    await assertUploadAndPrepareMissingFileFailsClearly(handlers);
    await assertUploadAndPrepareMissingKnowledgeNameFailsClearly(handlers);
    await assertBulkQueueSingleFileStillWorks(handlers);
    await assertBulkQueueMultiFileCreatesSeparateDrafts(handlers);
    await assertBulkQueueProcessesFilesSequentially(handlers);
    await assertBulkQueueFailureDoesNotStopLaterFiles(handlers);
    await assertBulkQueueCancelRemainingMarksUnprocessedCanceled(handlers);
    await assertBulkQueuePackNamesDoNotCollide(handlers);
    await assertBulkQueueFormulasRemainReferenceOnly(handlers);
    await assertUploadAndPrepareModelFailureReturnsClearJson(handlers);
    await assertLaterBatchCrashReturnsPartialReviewDraft(handlers);
    await assertUploadAndPrepareModelCrashShowsBatchSizeRecovery(handlers);
    await assertPrepareReviewModelTimeoutPreservesPlan(handlers);
    await assertInvalidPrepareReviewUploadIdRejected(handlers);
    await assertMissingPrepareReviewExtractionFails(handlers);
    await assertPrepareReviewModelFailureDoesNotWriteDraft(handlers);
    await assertPromoteDraftEndpointSucceeds(handlers);
    await assertPromoteBlocksPendingItems(handlers);
    await assertApprovedOnlyPromotionIgnoresUnselectedPendingItems(handlers);
    await assertSelectedOnlyPromotionUsesOnlySelectedRows(handlers);
    await assertCombinedApproveAllValidAcrossMultipleDrafts(handlers);
    await assertCombinedApproveSelectedAcrossMultipleDrafts(handlers);
    await assertCombinedApproveSelectedAllowsTeacherVerifiedLowConfidenceRows(handlers);
    await assertCombinedApproveSelectedStillBlocksMissingRequiredOrUnsafeRows(handlers);
    await assertCombinedApproveSelectedArchivesEmptiedDraftWhenApprovedPackIdDiffers(handlers);
    await assertCombinedApproveDedupesAndUpdatesExistingItem(handlers);
    await assertCombinedApproveRejectsUnsafePackIds(handlers);
    await assertFinalPublishUsesDraftPackIdOnlyAndArchivesDraft(handlers);
    await assertExistingDraftBlockersCanBeRejectedAndPromoted(handlers);
    await assertPromoteExcludesRejectedItems(handlers);
    await assertPromoteExcludesRepairNeededItems(handlers);
    await assertPromoteBlocksInvalidFormulaSolverStatus(handlers);
    await assertPromoteStrictValidationBlocksInvalidApprovedOutput(handlers);
    await assertPromoteDoesNotOverwriteWithoutForce(handlers);
    await assertPromoteOverwritesWithForce(handlers);
    await assertRemoveAcceptedDraftCopyArchivesDraftOnly(handlers);
    await assertRemoveAcceptedDraftCopyFindsApprovedPackByJsonPackId(handlers);
    await assertRemoveAcceptedDraftCopyMatchesApprovedByBlankSourceTitleFallback(handlers);
    await assertDraftsEndpointHidesSourceUploadIdMatchedAcceptedDrafts(handlers);
    await assertStaleDraftCanBeRemovedFromReviewQueueWithoutApprovedPack(handlers);
    await assertInvalidPromotePathTraversalRejected(handlers);
    await assertApproveDraftItemEndpoint(handlers);
    await assertApproveNeedsReviewLowConfidenceItemEndpoint(handlers);
    await assertRejectDraftItemEndpoint(handlers);
    await assertEditDraftItemEndpoint(handlers);
    await assertApproveDraftItemWithInlineEdits(handlers);
    await assertApproveDraftItemResolvesStableItemRefWhenIndexStale(handlers);
    await assertApproveDraftItemAfterFocusedEditRequiresRefreshedItemRef(handlers);
    await assertTeacherEditClearsLowConfidencePromotionBlock(handlers);
    await assertTeacherEditStillBlockedWhenRequiredFieldsRemainMissing(handlers);
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
    await assertApprovedBulkDeleteRequiresConfirmation(handlers);
    await assertDeleteSelectedRemovesApprovedAndDraftPacks(handlers);
    await assertDeleteAllRemovesEveryVisiblePack(handlers);
    await assertApprovedBulkDeletePathTraversalRejectedBeforeMutation(handlers);
    await assertApprovedDeleteRemovesMatchingDraftAndArchivedCopies(handlers);
    await assertDraftOnlyDeleteRemovesPackFromVisibleList(handlers);
    await assertDeleteByPackIdDoesNotRemoveSimilarTitlePack(handlers);
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

async function assertDraftReportNeedsReviewItemsAreIncluded(handlers) {
  const packId = 'route-needs-review-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [makeVocabularyItem('unbalanced-force', 'needs_review')],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.pendingReview.totalPending, 1);
    assert.equal(response.body.data.pendingReview.items.vocabulary[0].reviewStatus, 'needs_review');
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertDraftReportIncludesApprovedItemsBlockingPromotion(handlers) {
  const packId = 'route-approved-blocked-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('blocked-approved-term', 'approved'),
        confidence: 'low',
        sourceGrounding: {
          status: 'unsupported',
          termOrTitleFound: false,
          explanationSupported: false
        }
      },
      makeVocabularyItem('ready-approved-term', 'approved')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.pendingReview.totalPending, 0);
    assert.equal(response.body.data.reviewItems.items.vocabulary.some((item) => item.reviewStatus === 'approved'), true, 'report should include approved rows so UI can resolve promotion blockers.');
    assert.equal(response.body.data.promotionReadiness.ready, false);
    assert.ok(response.body.data.promotionReadiness.blockedReasons.some((reason) => reason.includes('source-grounding')));
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertDraftReportIncludesSalvageWarningsForAdvancedDetails(handlers) {
  const packId = 'route-salvage-report-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [makeVocabularyItem('route-salvage-term', 'pending')],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: [],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z',
      importWarnings: [
        'Removed invalid generated item vocabulary[2]: Missing required term and no usable title/label/name was available.'
      ],
      invalidGeneratedItems: [
        {
          section: 'vocabulary',
          index: 2,
          requiredField: 'term',
          reason: 'Missing required term and no usable title/label/name was available.'
        }
      ]
    }
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.reviewItems.items.vocabulary.length, 1, 'valid salvage rows should still render in page 2 review data.');
    assert.ok(response.body.data.warnings.some((warning) => warning.includes('Removed invalid generated item vocabulary[2]')));
    assert.ok(response.body.data.technicalErrors.some((detail) => detail.includes('Removed vocabulary[2] during draft salvage')));
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertDraftReportWithStoredCoverageAndMissingExtractionPages(handlers) {
  const packId = 'route-null-pages-report-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      makeVocabularyItem('route-alpha', 'needs_review'),
      makeVocabularyItem('route-beta', 'needs_review')
    ],
    concepts: [
      makeConceptItem('route-concept-alpha', 'needs_review')
    ],
    referenceFormulas: [],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z',
      importCoverage: {
        sourceManifest: [],
        coverageSummary: {},
        pages: null
      }
    }
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.reviewItems.items.vocabulary.length, 2);
    assert.equal(response.body.data.reviewItems.items.concepts.length, 1);
    assert.equal(response.body.data.pendingReview.totalPending, 3, 'needs_review should stay reviewable');
    assert.equal(Array.isArray(response.body.data.draftPacketItems.vocabulary), true);
    assert.equal(response.body.data.draftPacketItems.vocabulary.length, 2);
    assert.equal(response.body.data.draftPacketItems.concepts.length, 1);
    assert.equal(response.body.data.draftPacketItems.referenceFormulas.length, 0);
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertDraftReportPreservesStoredProcessedChunkCount(handlers) {
  const packId = 'route-coverage-processed-chunks-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [makeVocabularyItem('coverage-term', 'needs_review')],
    concepts: [],
    referenceFormulas: [],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z',
      importCoverage: {
        totalPages: 12,
        totalChunks: 12,
        processedPages: 12,
        processedChunks: 12,
        sourceManifest: Array.from({ length: 12 }, (_, index) => ({
          chunkId: `chunk-${index + 1}`,
          sourceFile: 'electricity_magnetism_packet.pdf',
          sourceLocation: `Page ${index + 1}`,
          chunkIndex: index + 1,
          charCount: 200,
          status: 'drafted'
        })),
        coverageSummary: {
          totalChunks: 12,
          queuedChunks: 0,
          draftedChunks: 12,
          skippedEmptyChunks: 0,
          noItemsFoundChunks: 0,
          needsReviewChunks: 0,
          failedChunks: 0,
          totalSourceChars: 2400,
          completedChunks: 12,
          allChunksTerminal: true
        }
      }
    }
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.coverageReport.processedChunks, 12);
    assert.equal(response.body.data.coverageReport.totalChunks, 12);
    assert.equal(response.body.data.coverageSummary.totalChunks, 12);
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertDraftReportSuppressesPausedStandardsWarnings(handlers) {
  const packId = 'route-paused-standards-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const response = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    const warnings = Array.isArray(response.body.data.warnings) ? response.body.data.warnings : [];
    assert.equal(warnings.some((warning) => /standardsmap is empty/i.test(String(warning))), false);
    assert.equal(warnings.some((warning) => /smoketests is empty/i.test(String(warning))), false);
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
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
  assert.equal(response.body.data.packId, 'draft-teacher-prepared-forces-prepare-review-upload');
  assert.equal(response.body.data.title, 'Teacher Prepared Forces');
  assert.equal(response.body.data.message, 'Review draft prepared.');
  assert.equal(response.body.data.sourceMatch.uploadedFileName, 'teacher_prepare_review_notes.txt');
  assert.equal(response.body.data.sourceMatch.draftPackId, response.body.data.packId);
  assert.equal(response.body.data.sourceMatch.draftTitle, 'Teacher Prepared Forces');
  assert.deepEqual(response.body.data.sourceMatch.draftSourceFiles, ['teacher_prepare_review_notes.txt']);
  assert.equal(response.body.data.sourceMatch.extractionCharacterCount, 112);
  assert.equal(response.body.data.sourceMatch.chunkCount, 1);
  assert.equal(response.body.data.sourceMatch.status, 'matched');
  assert.equal(response.body.data.dashboard.draftPacks, 2);
  assert.ok(response.body.data.drafts.some((draft) => draft.packId === response.body.data.packId));
  assert.equal(response.body.data.draftReport.draftPack.packId, response.body.data.packId);
  assert.equal(response.body.data.draftReport.draftPack.importScope.scope, 'full_document');
  assert.equal(response.body.data.importScope.completePacketImported, true);
  assert.equal(response.body.data.draftReport.coverageReport.totalChunks, 1);
  assert.equal(response.body.data.draftReport.coverageReport.processedChunks, 1);
  assert.equal(response.body.data.draftReport.coverageSummary.totalChunks, 1);
  assert.equal(response.body.data.draftReport.coverageSummary.draftedChunks, 1);
  assert.equal(response.body.data.draftReport.coverageSummary.queuedChunks, 0);
  assert.equal(response.body.data.coverageSummary.totalChunks, 1);
  assert.equal(response.body.data.coverageSummary.draftedChunks, 1);
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
  assert.equal(generated.title, 'Teacher Prepared Forces');
  assert.equal(generated.metadata.importScope.scope, 'full_document');
  assert.equal(generated.metadata.importProfile, 'general');
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.ok(['pending', 'needs_review'].includes(generated.concepts[0].reviewStatus));
  assert.ok(['pending', 'needs_review'].includes(generated.problemBank[0].reviewStatus));
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.ok(['pending', 'needs_review'].includes(generated.referenceFormulas[0].reviewStatus));

  const addedDraftFiles = Object.keys(snapshotFiles(draftPacksDir)).filter((filePath) => !draftFilesBefore[filePath]);
  assert.deepEqual(addedDraftFiles, [path.join(response.body.data.packId, 'knowledge_pack.json')]);
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'Prepare Review should not modify real approved packs.');
}

async function assertPrepareReviewImportProfileSelection(handlers) {
  const uploadId = 'prepare-review-import-profile';
  const extractionPath = path.join(uploadExtractedDir, `${uploadId}_extraction.json`);
  fs.writeFileSync(extractionPath, `${JSON.stringify(makeExtraction({
    uploadId,
    originalFileName: 'physical_science_teacher_notes.txt'
  }), null, 2)}\n`);

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Physical Science Notes',
    importMode: 'full',
    confirmFullImport: true,
    importProfile: 'physical_science'
  }, {
    uploadId
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  const createdPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  const generated = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  assert.equal(generated.metadata.importProfile, 'physical_science');
  assert.equal(generated.metadata.sourceUpload.importProfile, 'physical_science');

  const futureProfileUploadId = 'prepare-review-future-import-profile';
  const futureProfileExtractionPath = path.join(uploadExtractedDir, `${futureProfileUploadId}_extraction.json`);
  fs.writeFileSync(futureProfileExtractionPath, `${JSON.stringify(makeExtraction({
    uploadId: futureProfileUploadId,
    originalFileName: 'math_teacher_notes.txt'
  }), null, 2)}\n`);

  const futureProfileResponse = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Math Notes',
    importMode: 'full',
    confirmFullImport: true,
    importProfile: 'math'
  }, {
    uploadId: futureProfileUploadId
  });
  assert.equal(futureProfileResponse.statusCode, 200);
  assert.equal(futureProfileResponse.body.success, true);
  const futureProfilePath = path.join(draftPacksDir, futureProfileResponse.body.data.packId, 'knowledge_pack.json');
  const futureProfileGenerated = JSON.parse(fs.readFileSync(futureProfilePath, 'utf8'));
  assert.equal(futureProfileGenerated.metadata.importProfile, 'math');
  assert.equal(futureProfileGenerated.metadata.sourceUpload.importProfile, 'math');
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
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
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
  assert.equal(calls.length, 0, 'large full import should not call Gemma before confirmation.');

  const booleanOnlyResponse = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Large Confirm Required',
    importMode: 'full',
    confirmFullImport: true
  }, {
    uploadId
  });

  assert.equal(booleanOnlyResponse.statusCode, 409);
  assert.equal(calls.length, 0, 'large full import should require typed confirmation, not a boolean.');

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
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
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
  assert.ok(response.body.data.coverageSummary.totalChunks >= response.body.data.previewReport.processedChunkCount);
  assert.ok(calls.length >= 1, 'preview should call Gemma on the sample.');
  assert.equal(calls[0].timeoutMs, 120000, 'preview/selected imports should use a bounded teacher-content timeout by default.');
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
        equation: '',
        formula: '',
        expression: '',
        formulaText: '',
        sourceTextSnippet: '',
        sourceSnippet: ''
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
  assert.equal(response.body.data.partialPreview, false);
  assert.equal(response.body.data.validationPassed, true);
  assert.equal(response.body.data.previewReport.partialPreview, false);
  assert.equal(response.body.data.previewReport.validationPassed, true);
  assert.equal(response.body.data.previewReport.pack.vocabulary.length, 1);
  assert.equal(response.body.data.previewReport.pack.referenceFormulas.length, 0);
  assert.ok(response.body.data.timeline.some((event) => event.type === 'normalization_complete'));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'salvaged preview should not write a final draft pack.');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack({
    packId: 'route-salvage-selected-pack',
    vocabulary: [makeVocabularyItem('selected-valid', 'pending')],
    concepts: [],
    referenceFormulas: [
      {
        ...makeReferenceFormula('selected-recoverable', 'pending'),
        equation: '',
        formula: 'F = m * a'
      }
    ],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
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

  assert.equal(selectedResponse.statusCode, 200);
  assert.equal(selectedResponse.body.success, true);
  assert.equal(selectedResponse.body.data.partialDraft, false);
  assert.ok(selectedResponse.body.data.packId);
  assert.equal(selectedResponse.body.data.draftReport.draftPacketItems.vocabulary.length, 1);
  assert.equal(selectedResponse.body.data.draftReport.draftPacketItems.referenceFormulas.length, 1, 'recoverable formula rows should be salvaged for selected/full draft imports.');
  const selectedDraftFilesAfter = snapshotFiles(draftPacksDir);
  assert.notDeepEqual(selectedDraftFilesAfter, selectedDraftFilesBefore, 'selected import should write salvaged draft rows.');

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
  assert.ok(response.body.errors[0].includes('No usable preview items'));
  assert.ok(response.body.errors.some((error) => error.includes('Removed referenceFormulas[0] during draft salvage')));
  assert.ok(Array.isArray(response.body.invalidItems));
  assert.equal(response.body.invalidItems.length, 1);

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
        term: 'selected-page-2',
        aliases: [],
        studentDefinition: 'Selected page 2 definition.',
        teacherDefinition: 'Selected page 2 definition.',
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
  assert.equal(response.body.data.coverageSummary.totalChunks, 6);
  assert.equal(response.body.data.coverageSummary.queuedChunks, 3);
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
  assert.equal(generated.metadata.importCoverage.totalPages, 6);
  assert.equal(generated.metadata.importCoverage.coverageSummary.queuedChunks, 3);
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.equal(generated.vocabulary[0].sourceLocation, 'Pages 2-4');

  const addedDraftFiles = Object.keys(snapshotFiles(draftPacksDir)).filter((filePath) => !draftFilesBefore[filePath]);
  assert.deepEqual(addedDraftFiles, [path.join(response.body.data.packId, 'knowledge_pack.json')]);

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertAutoPlanPrepareReviewWithoutManualMode(handlers) {
  const uploadId = 'auto-plan-no-manual-mode';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'auto_plan_teacher_packet.pdf',
    pages: 2,
    charactersPerPage: 700
  }), null, 2)}\n`);
  const calls = [];
  mockDraftModelClient = async (request) => {
    calls.push(request);
    return JSON.stringify(makeGeneratedPack({
      packId: 'auto-plan-draft',
      title: 'Auto Plan Draft'
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Auto Plan Teacher Draft',
    useAutoImportPlan: true,
    useRecommendedImportPlan: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, 'draft-auto-plan-teacher-draft-auto-plan-no-manual-mode');
  assert.equal(response.body.data.autoImportPlan.recommendedImportScope, 'full_document');
  assert.equal(response.body.data.autoImportPlan.limits.maxCharactersPerBatch, 400);
  assert.equal(response.body.data.autoImportPlan.batchCount, 4);
  assert.equal(response.body.data.importScope.scope, 'full_document');
  assert.ok(calls.length > 1, 'accepted auto planner should keep looping across multiple source chunks.');
  calls.forEach((call) => {
    const sourceText = String(call.prompt || '').match(/EXTRACTED SOURCE TEXT[\s\S]*?OUTPUT JSON ONLY/)?.[0] || '';
    assert.ok(sourceText.length < 1800, 'auto Analyze Upload prompt source should stay conservatively bounded.');
  });

  const createdPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  const generated = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  assert.equal(generated.metadata.autoImportPlan.recommendedImportScope, 'full_document');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertLargeAnalyzeUploadAvoidsPreviewHardStop(handlers) {
  const uploadId = 'analyze-large-upload';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'large_teacher_text_pdf.pdf',
    pages: 12,
    charactersPerPage: 686
  }), null, 2)}\n`);
  const calls = [];
  mockDraftModelClient = async ({ prompt }) => {
    calls.push(prompt);
    const pageMatch = String(prompt || '').match(/Page\s+(\d+)/i);
    const page = pageMatch ? Number(pageMatch[1]) : calls.length;
    return JSON.stringify(makeGeneratedPack({
      packId: 'analyze-large-upload-draft',
      vocabulary: [{
        ...makeVocabularyItem(`large-upload-${page}`, 'pending'),
        sourceLocation: `Page ${page}`,
        sourceTextSnippet: `large upload page ${page}`
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Large Analyze Upload',
    useAutoImportPlan: true,
    useRecommendedImportPlan: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.importScope.scope, 'full_document');
  assert.ok(calls.length > 1, 'large analyze should run sequential adaptive chunks, not stop before drafting.');
  assert.ok(response.body.data.timeline.some((event) => event.type === 'adaptive_progress_saved'));
  assert.equal(response.body.data.coverageSummary.totalChunks, 12);
  assert.equal(response.body.data.coverageSummary.queuedChunks, 0);
  assert.equal(response.body.data.coverageSummary.allChunksTerminal, true);
  assert.ok(['partial', 'completed'].includes(response.body.data.reviewState));
  assert.ok(!JSON.stringify(response.body).includes('Run preview first or lower batch size'));

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertAutoPreviewOnlyPlanStillRunsAdaptiveAnalyze(handlers) {
  const uploadId = 'auto-preview-only-plan-analyze';
  const extraction = makeLargePdfExtraction({
    uploadId,
    originalFileName: 'auto_preview_only_plan.pdf',
    pages: 12,
    charactersPerPage: 686
  });
  extraction.importPlan = {
    mode: 'auto_preview_only',
    recommendedImportScope: 'preview_sample',
    batchStrategy: 'preview_then_continue',
    batchCount: 1,
    batches: [{
      batchIndex: 1,
      sourceLocations: ['Page 1'],
      pageNumbers: [1],
      estimatedCharacters: 686,
      estimatedTokens: 229
    }],
    limits: {
      maxCharactersPerBatch: 686,
      maxEstimatedTokensPerBatch: 229,
      memory: { availableMemoryMb: 256 }
    },
    warnings: ['Available memory is low (256 MB).'],
    reason: 'Legacy preview-only planner recommendation.',
    extractionSummary: {
      pageSlideSheetCount: 12,
      textBearingPageSlideSheetCount: 12,
      characterCount: 8232,
      largestSectionCharacters: 686,
      estimatedTokens: 2744,
      firstTextBearingPageSlideSheet: 1
    }
  };
  writeExtractionFixture(uploadId, extraction);

  const calls = [];
  mockDraftModelClient = async ({ prompt }) => {
    calls.push(prompt);
    return JSON.stringify(makeGeneratedPack({
      packId: 'auto-preview-only-adaptive',
      vocabulary: [makeVocabularyItem(`auto-preview-${calls.length}`, 'pending')],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Auto Preview Plan Analyze',
    useAutoImportPlan: true,
    useRecommendedImportPlan: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.autoImportPlan.mode, 'auto_preview_only');
  assert.equal(response.body.data.importScope.scope, 'full_document');
  assert.ok(calls.length > 1, 'Analyze should still use adaptive full import even when legacy planner mode is auto_preview_only.');
  assert.ok(response.body.data.timeline.some((event) => event.type === 'adaptive_progress_saved'));

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertAnalyzeAdaptiveLoopProcessesManifestToTerminal(handlers) {
  const uploadId = 'adaptive-loop-analyze';
  const extraction = makeAdaptiveLoopRouteExtraction({
    uploadId,
    originalFileName: 'adaptive_loop_analyze.pdf'
  });
  writeExtractionFixture(uploadId, extraction);
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const calls = [];
  mockDraftModelClient = async ({ prompt }) => {
    const text = String(prompt || '');
    const pageMatch = text.match(/"label":\s*"Page\s+(\d+)"/i) || text.match(/Page\s+(\d+)/i);
    const page = pageMatch ? Number(pageMatch[1]) : 1;
    const marker = text.includes('ADAPTIVE_FAIL_CHUNK_TOKEN') ? 'fail'
      : text.includes('ADAPTIVE_NO_ITEMS_CHUNK_TOKEN') ? 'no_items'
      : 'drafted';
    calls.push(marker);
    if (marker === 'fail') {
      throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
    }
    if (marker === 'no_items') {
      return JSON.stringify(makeGeneratedPack({
        packId: 'route-adaptive-loop-draft',
        vocabulary: [],
        concepts: [],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
    return JSON.stringify(makeGeneratedPack({
      packId: 'route-adaptive-loop-draft',
      vocabulary: [{
        ...makeVocabularyItem(`adaptive-${page}`, 'pending'),
        sourceLocation: `Page ${page}`,
        sourceTextSnippet: `adaptive page ${page} source`
      }],
      concepts: [{
        ...makeConceptItem(`adaptive-concept-${page}`, 'pending'),
        sourceLocation: `Page ${page}`,
        sourceTextSnippet: `adaptive page ${page} source`
      }],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Adaptive Loop Analyze',
    useAutoImportPlan: true,
    useRecommendedImportPlan: true
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.importScope.scope, 'full_document');
  assert.ok(calls.length > 1, 'adaptive loop should process multiple queued chunks.');
  assert.equal(response.body.data.reviewState, 'partial');
  assert.ok(response.body.data.coverageReport);
  assert.ok(Array.isArray(response.body.data.sourceManifest));
  assert.equal(response.body.data.coverageSummary.totalChunks, 6);
  assert.equal(response.body.data.coverageSummary.queuedChunks, 0);
  assert.equal(response.body.data.coverageSummary.noItemsFoundChunks, 1);
  assert.equal(response.body.data.coverageSummary.failedChunks, 1);
  assert.equal(response.body.data.coverageSummary.skippedEmptyChunks, 1);
  assert.equal(response.body.data.coverageSummary.needsReviewChunks, 1);
  assert.ok(response.body.data.failedBatches.length >= 1);
  assert.ok(response.body.data.coverageReport.warnings.some((warning) => warning.includes('1 section failed after retry')));
  assert.ok(response.body.data.coverageReport.noKnowledgeChunks.includes('Page 6'));
  assert.ok(response.body.data.timeline.some((event) => event.type === 'adaptive_progress_saved'));

  const createdPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  assert.equal(fs.existsSync(createdPath), true);
  const generated = JSON.parse(fs.readFileSync(createdPath, 'utf8'));
  assert.equal(generated.metadata.importCoverage.coverageSummary.allChunksTerminal, true);
  assert.equal(generated.metadata.importCoverage.coverageSummary.failedChunks, 1);
  assert.equal(generated.metadata.importCoverage.coverageSummary.noItemsFoundChunks, 1);
  assert.ok(generated.vocabulary.some((item) => item.sourceLocation === 'Page 1'));
  assert.ok(generated.vocabulary.some((item) => item.sourceLocation === 'Page 2'));
  assert.ok(!generated.vocabulary.some((item) => item.sourceLocation === 'Page 5'));

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

function assertAutoImportPlannerLowMemoryUsesAutomaticSmallerChunks() {
  const plan = planTeacherContentImport({
    extraction: makePlannerExtraction(['A'.repeat(1500), 'B'.repeat(1500)]),
    settings: { maxBatchCharacters: 1600 },
    memory: makePlannerMemory(512, 8192)
  });

  assert.equal(plan.mode, 'auto_full');
  assert.equal(plan.recommendedImportScope, 'full_document');
  assert.equal(plan.batchStrategy, 'sequential_batches');
  assert.ok(plan.batchCount >= 2);
  assert.ok(plan.limits.maxCharactersPerBatch < 1600);
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
  assert.equal(Array.isArray(extractionJson.sourceManifest), true);
  assert.equal(extractionJson.sourceManifest.length, 1);
  assert.equal(extractionJson.sourceManifest[0].status, 'queued');

  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'upload extraction should not create or modify draft packs');
  assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedFilesBefore, 'upload extraction should not modify real approved packs');
}

async function assertUploadExtractionCleanupAndChunkMetadata(handlers) {
  const response = await requestMultipart(handlers, '/uploads/extract', {
    fileName: 'cleanup_teacher_packet.txt',
    contentType: 'text/plain',
    content: [
      'Unit 3 Motion and Forces',
      'Page 1',
      'UNIT 3 MOTION AND FORCES',
      '',
      'VOCABULARY',
      'Net force: The total force acting on an object.',
      '',
      'Page 2',
      'UNIT 3 MOTION AND FORCES',
      '',
      'WORKSHEET SECTION:',
      'Balanced forces cancel and result in no acceleration.',
      '2',
      '',
      'Page 3',
      'UNIT 3 MOTION AND FORCES',
      '',
      'CORE CONCEPT',
      'Unbalanced forces change an object\'s motion.'
    ].join('\n')
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.originalFileName, 'cleanup_teacher_packet.txt');
  assert.equal(response.body.data.fileType, 'txt');
  assert.equal(response.body.data.sectionsCount >= 2, true, 'cleanup should split heading sections into multiple chunks.');

  const extractionPath = path.join(uploadExtractedDir, response.body.data.extractionJsonFileName);
  const extractionJson = JSON.parse(fs.readFileSync(extractionPath, 'utf8'));
  assert.equal(extractionJson.success, true);
  assert.ok(extractionJson.text.includes('Net force: The total force acting on an object.'));
  assert.ok(extractionJson.text.includes('Balanced forces cancel and result in no acceleration.'));
  assert.ok(extractionJson.text.includes('Unbalanced forces change an object\'s motion.'));
  assert.equal(extractionJson.text.includes('Page 1'), false);
  assert.equal(extractionJson.text.includes('Page 2'), false);
  assert.equal(extractionJson.text.includes('UNIT 3 MOTION AND FORCES'), false);
  assert.equal(Array.isArray(extractionJson.sections), true);
  assert.equal(extractionJson.sections.length >= 2, true);
  assert.equal(extractionJson.sections.every((section, index) => section.chunkIndex === index + 1), true);
  assert.equal(extractionJson.sections.every((section) => section.sourceFile === 'cleanup_teacher_packet.txt'), true);
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

async function assertBulkQueueSingleFileStillWorks(handlers) {
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_single_teacher_notes.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_FILE_1 single file import.'
    }
  ]);
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].status, 'draft_ready');
  assert.ok(queue.items[0].packId);
}

async function assertBulkQueueMultiFileCreatesSeparateDrafts(handlers) {
  mockDraftModelClient = async ({ prompt }) => JSON.stringify(makeGeneratedPack({
    vocabulary: [makeVocabularyItem(String(prompt || '').includes('BULK_QUEUE_FILE_2') ? 'bulk-two' : 'bulk-one', 'pending')]
  }));
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_queue_file_one.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_FILE_1 first file.'
    },
    {
      fileName: 'bulk_queue_file_two.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_FILE_2 second file.'
    }
  ]);
  assert.equal(queue.items.length, 2);
  assert.equal(queue.items[0].status, 'draft_ready');
  assert.equal(queue.items[1].status, 'draft_ready');
  assert.ok(queue.items[0].packId);
  assert.ok(queue.items[1].packId);
  assert.notEqual(queue.items[0].packId, queue.items[1].packId, 'each bulk file should create a separate draft pack');
}

async function assertBulkQueueProcessesFilesSequentially(handlers) {
  const order = [];
  mockDraftModelClient = async ({ prompt }) => {
    if (String(prompt || '').includes('BULK_QUEUE_SEQ_1')) order.push('first');
    if (String(prompt || '').includes('BULK_QUEUE_SEQ_2')) order.push('second');
    return JSON.stringify(makeGeneratedPack());
  };
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_queue_seq_one.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_SEQ_1 sequential first.'
    },
    {
      fileName: 'bulk_queue_seq_two.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_SEQ_2 sequential second.'
    }
  ]);
  assert.equal(queue.items[0].status, 'draft_ready');
  assert.equal(queue.items[1].status, 'draft_ready');
  assert.deepEqual(order.slice(0, 2), ['first', 'second'], 'bulk queue should process one file at a time in order');
}

async function assertBulkQueueFailureDoesNotStopLaterFiles(handlers) {
  mockDraftModelClient = async ({ prompt }) => {
    const text = String(prompt || '');
    if (text.includes('BULK_QUEUE_FAIL_TOKEN')) {
      throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
    }
    return JSON.stringify(makeGeneratedPack());
  };
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_queue_fail_first.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_FAIL_TOKEN fail this file.'
    },
    {
      fileName: 'bulk_queue_after_failure.txt',
      contentType: 'text/plain',
      content: 'BULK_QUEUE_FILE_AFTER_FAILURE continue.'
    }
  ]);
  assert.equal(queue.items[0].status, 'failed');
  assert.equal(queue.items[1].status, 'draft_ready', 'a failed file should not block later queued files');
}

async function assertBulkQueueCancelRemainingMarksUnprocessedCanceled(handlers) {
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
  const reliableContent = 'Net force is the total force on an object. Balanced forces do not change motion.';
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_queue_cancel_one.txt',
      contentType: 'text/plain',
      content: `BULK_CANCEL_ONE ${reliableContent}`
    },
    {
      fileName: 'bulk_queue_cancel_two.txt',
      contentType: 'text/plain',
      content: `BULK_CANCEL_TWO ${reliableContent}`
    },
    {
      fileName: 'bulk_queue_cancel_three.txt',
      contentType: 'text/plain',
      content: `BULK_CANCEL_THREE ${reliableContent}`
    }
  ], {
    cancelAfterIndex: 0
  });
  assert.equal(queue.items[0].status, 'draft_ready');
  assert.equal(queue.items[1].status, 'canceled');
  assert.equal(queue.items[2].status, 'canceled');
}

async function assertBulkQueuePackNamesDoNotCollide(handlers) {
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
  const reliableContent = 'Net force is the total force on an object. Balanced forces do not change motion.';
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'physics notes.txt',
      contentType: 'text/plain',
      content: `PHYSICS_NOTES_ONE ${reliableContent}`
    },
    {
      fileName: 'physics-notes.txt',
      contentType: 'text/plain',
      content: `PHYSICS_NOTES_TWO ${reliableContent}`
    }
  ]);
  assert.equal(queue.items[0].status, 'draft_ready');
  assert.equal(queue.items[1].status, 'draft_ready');
  assert.notEqual(queue.items[0].packId, queue.items[1].packId, 'similar file names should still generate distinct draft IDs');
}

async function assertBulkQueueFormulasRemainReferenceOnly(handlers) {
  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack({
    referenceFormulas: [
      {
        ...makeReferenceFormula('bulk-queue-formula', 'pending'),
        solverStatus: 'science_formula_rules'
      }
    ]
  }));
  const queue = await runSyntheticBulkUploadQueue(handlers, [
    {
      fileName: 'bulk_formula_reference_only.txt',
      contentType: 'text/plain',
      content: 'BULK_FORMULA_REFERENCE_ONLY'
    }
  ]);
  assert.equal(queue.items[0].status, 'draft_ready');
  const generated = readKnowledgePack(draftPacksDir, queue.items[0].packId);
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
}

async function runSyntheticBulkUploadQueue(handlers, files, options = {}) {
  const queueItems = files.map((file, index) => ({
    fileName: file.fileName,
    proposedPackName: file.knowledgeName || makeContentNameFromTestFileName(file.fileName, index + 1),
    status: 'waiting',
    uploadId: '',
    packId: '',
    error: ''
  }));
  let cancelRemaining = false;

  for (let index = 0; index < queueItems.length; index += 1) {
    const item = queueItems[index];
    if (cancelRemaining) {
      item.status = 'canceled';
      continue;
    }

    item.status = 'extracting';
    const uploadResponse = await requestMultipart(handlers, '/uploads/upload-and-prepare', {
      fileName: files[index].fileName,
      contentType: files[index].contentType,
      content: files[index].content,
      fields: {
        knowledgeName: item.proposedPackName
      }
    });

    if (uploadResponse.statusCode !== 200 || uploadResponse.body.success !== true) {
      item.status = 'failed';
      item.error = (uploadResponse.body.errors || [uploadResponse.body.error || 'Extraction failed'])[0];
      if (options.cancelAfterIndex === index) cancelRemaining = true;
      continue;
    }

    const uploadId = uploadResponse.body.data.upload.uploadId;
    item.uploadId = uploadId;
    item.status = 'processing';

    const prepareResponse = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
      packName: item.proposedPackName,
      knowledgeName: item.proposedPackName,
      importMode: 'full',
      confirmFullImport: true,
      useAutoImportPlan: true,
      useRecommendedImportPlan: true
    }, {
      uploadId
    });

    if (prepareResponse.statusCode === 200 && prepareResponse.body.success === true) {
      item.status = 'draft_ready';
      item.packId = prepareResponse.body.data.packId;
    } else {
      item.status = 'failed';
      item.error = (prepareResponse.body.errors || [prepareResponse.body.error || 'Draft generation failed'])[0];
    }

    if (options.cancelAfterIndex === index) {
      cancelRemaining = true;
    }
  }

  return { items: queueItems };
}

function makeContentNameFromTestFileName(fileName, fallbackIndex) {
  const name = String(fileName || '')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return name || `Queue File ${fallbackIndex}`;
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

async function assertLaterBatchCrashReturnsPartialReviewDraft(handlers) {
  const uploadId = 'prepare-partial-later-crash';
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(makeLargePdfExtraction({
    uploadId,
    originalFileName: 'teacher_partial_later_crash.pdf',
    pages: 3,
    charactersPerPage: 700
  }), null, 2)}\n`);
  let calls = 0;
  mockDraftModelClient = async () => {
    calls += 1;
    if (calls >= 3) {
      throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
    }
    return JSON.stringify(makeGeneratedPack({
      packId: `route-partial-later-crash-${calls}`,
      sourceFiles: [{
        fileName: 'teacher_partial_later_crash.pdf',
        fileType: 'pdf',
        reviewStatus: 'approved',
        confidence: 'high'
      }],
      vocabulary: [{
        ...makeVocabularyItem(`selected-page-${calls}`, 'approved'),
        term: `selected-page-${calls}`,
        sourceFile: 'teacher_partial_later_crash.pdf',
        sourceLocation: `Page ${calls}`,
        sourceTextSnippet: `selected-page-${calls} means Selected page ${calls} definition`
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }));
  };

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Partial Later Crash',
    importMode: 'full',
    confirmFullImport: true,
    maxBatchCharacters: 750,
    maxBatchChunks: 1,
    retryMaxBatchCharacters: 350
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.partialDraft, true);
  assert.equal(response.body.data.packId, 'draft-partial-later-crash-prepare-partial-later-crash');
  assert.ok(response.body.data.message.includes('Some slides could not be analyzed'));
  assert.ok(response.body.data.failedBatches.some((batch) => Array.isArray(batch.pages) && batch.pages.includes(3)));
  assert.ok(response.body.data.draftReport.pendingReview.totalPending > 0, 'partial success should move to Review Draft Content with cards.');

  const generatedPath = path.join(draftPacksDir, response.body.data.packId, 'knowledge_pack.json');
  const generated = JSON.parse(fs.readFileSync(generatedPath, 'utf8'));
  assert.equal(generated.metadata.partialDraft, true);
  assert.deepEqual(generated.metadata.partialImport.failedPages, [3]);
  assert.ok(generated.metadata.importCoverage.failedBatches[0].pages.includes(3));
  assert.ok(!generated.vocabulary.some((item) => item.sourceLocation === 'Page 3'), 'failed slide items must not be written into the partial draft.');

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
  assert.equal(response.body.teacherFriendlyError, 'Local Gemma crashed while reading this batch.');
  assert.equal(response.body.error, 'Local Gemma crashed while reading this batch.');
  assert.ok(response.body.errors.some((error) => error.includes('Local Gemma crashed while reading batch 1')));
  assert.ok(response.body.errors.some((error) => error.includes('Retry failed after a smaller batch.')));
  assert.equal(
    response.body.errors.filter((error) => error.includes('Ollama returned HTTP 500')).length,
    1,
    'raw Ollama crash detail should not repeat in route errors'
  );
  assert.ok(response.body.technicalErrors.some((error) => error.includes('Ollama returned HTTP 500')));
  assert.ok(Array.isArray(response.body.timeline));
  assert.ok(response.body.timeline.some((event) => event.type === 'batch_retry'));
  assert.ok(Array.isArray(response.body.failedBatches));
  assert.ok(response.body.failedBatches.length >= 1);
  assert.ok(response.body.failedBatches.some((batch) => Array.isArray(batch.pages) || Array.isArray(batch.chunkLabels)), 'failed batch/page/slide details should be visible for teacher retry');
  assert.ok(response.body.coverageReport.warnings.some((warning) => warning.includes('Model draft failed for batch 1')));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'model crash failure should not write a partial draft pack');

  mockDraftModelClient = async () => JSON.stringify(makeGeneratedPack());
}

async function assertPrepareReviewModelTimeoutPreservesPlan(handlers) {
  const draftFilesBefore = snapshotFiles(draftPacksDir);
  const uploadId = 'prepare-model-timeout';
  const extraction = makeLargePdfExtraction({
    uploadId,
    originalFileName: 'teacher_model_timeout_notes.pdf',
    pages: 3,
    charactersPerPage: 650
  });
  fs.writeFileSync(path.join(uploadExtractedDir, `${uploadId}_extraction.json`), `${JSON.stringify(extraction, null, 2)}\n`);
  mockDraftModelClient = async () => new Promise(() => {});

  const response = await request(handlers, 'POST', '/uploads/:uploadId/prepare-review', {
    packName: 'Energy Model Timeout',
    importMode: 'preview',
    previewOnly: true,
    timeoutMs: 5,
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  }, {
    uploadId
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.equal(response.body.teacherFriendlyError, 'Local Gemma took too long while reading this batch.');
  assert.equal(response.body.error, 'Local Gemma took too long while reading this batch.');
  assert.equal(response.body.uploadId, uploadId);
  assert.equal(response.body.originalFileName, 'teacher_model_timeout_notes.pdf');
  assert.equal(response.body.modelTimeout, true);
  assert.equal(response.body.modelCrash, true);
  assert.ok(response.body.importEstimate);
  assert.ok(response.body.autoImportPlan);
  assert.ok(response.body.extraction);
  assert.ok(response.body.extractionMetadata);
  assert.equal(response.body.extractionSummary.originalFileName, 'teacher_model_timeout_notes.pdf');
  assert.deepEqual(response.body.importSelection, {
    pageStart: 1,
    pageEnd: 1,
    chunkStart: undefined,
    chunkEnd: undefined
  });
  assert.ok(Array.isArray(response.body.timeline));
  assert.ok(response.body.timeline.some((event) => event.type === 'error' && event.message.includes('Local Gemma took too long')));
  assert.ok(Array.isArray(response.body.failedBatches));
  assert.ok(response.body.failedBatches[0].errors.includes('Local Gemma took too long while reading this batch.'));
  assert.deepEqual(snapshotFiles(draftPacksDir), draftFilesBefore, 'model timeout failure should not write a partial draft pack');

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
  assert.equal(approvedPack.activationEnabled, true);
  assert.equal(approvedPack.activationStatus, 'enabled');
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
  assert.equal(response.body.data.message, 'Activation setting saved. Enabled packs are available for student answers.');
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
  assert.match(response.body.errors[0], /confirmed must be true/);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-approved-pack', 'knowledge_pack.json')), true);
}

async function assertInvalidApprovedDeletePathTraversalRejected(handlers) {
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmed: true
  }, {
    packId: '../route-approved-pack'
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packId/);
}

async function assertMissingApprovedDeletePackRejected(handlers) {
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmed: true
  }, {
    packId: 'missing-approved-pack'
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /No matching saved knowledge pack/);
}

async function assertApprovedDeleteRemovesMatchingDraftAndArchivedCopies(handlers) {
  const packId = 'route-approved-pack';
  const uploadedSourcePath = path.join(uploadIncomingDir, 'route-approved-source.pdf');
  fs.writeFileSync(uploadedSourcePath, 'uploaded source remains');
  writeKnowledgePack(approvedPacksDir, makePack({
    packId,
    title: 'Route Approved Pack',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('route-approved-source', 'approved')]
  }));
  fs.writeFileSync(activationRegistryPath, `${JSON.stringify({
    version: 1,
    packs: {
      [packId]: { enabled: true, updatedAt: '2026-01-01T00:00:00.000Z' }
    }
  }, null, 2)}\n`);
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Approved Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-approved-draft-copy', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_accepted', `2026-01-01T00-00-00-000Z-${packId}`), makePack({
    packId,
    title: 'Route Approved Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-approved-accepted-copy', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_removed', `2026-01-01T00-00-00-000Z-${packId}`), makePack({
    packId,
    title: 'Route Approved Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-approved-removed-copy', 'approved')]
  }));
  const uploadsBefore = snapshotFiles(path.join(tempRoot, 'uploads'));
  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmed: true
  }, {
    packId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, packId);
  assert.equal(response.body.data.removedActivation, true);
  assert.equal(response.body.data.sourceFilesPreserved, true);
  assert.equal(response.body.deleted.length, 2);
  assert.deepEqual(response.body.notFound, []);
  assert.deepEqual(response.body.errors, []);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, packId, 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, '_accepted', `2026-01-01T00-00-00-000Z-${packId}`, packId, 'knowledge_pack.json')), true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, '_removed', `2026-01-01T00-00-00-000Z-${packId}`, packId, 'knowledge_pack.json')), true);
  assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8')).packs, packId), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === packId), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-draft-pack'), false, 'approved delete should keep visible draft list clean for matching pack IDs.');
  const dashboard = await request(handlers, 'GET', '/dashboard');
  assert.equal(dashboard.statusCode, 200);
  const draftsResponse = await request(handlers, 'GET', '/drafts');
  assert.equal(
    (draftsResponse.body.data.draftPacks || []).length,
    dashboard.body.data.draftPacks,
    'dashboard draft count should match the draft summary endpoint after approved delete.'
  );
  assert.equal(draftsResponse.body.data.draftPacks.some((pack) => pack.packId === packId), false, 'deleted approved pack should not appear in draft list.');
  assert.deepEqual(snapshotFiles(path.join(tempRoot, 'uploads')), uploadsBefore, 'delete should not remove uploaded source files');
}

async function assertDeleteSelectedRemovesApprovedAndDraftPacks(handlers) {
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
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-bulk-delete-draft-only',
    title: 'Route Bulk Delete Draft Only',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('bulk-delete-draft-only', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_accepted', '2026-01-01T00-00-00-000Z-route-bulk-delete-pack-two'), makePack({
    packId: 'route-bulk-delete-pack-two',
    title: 'Route Bulk Delete Pack Two',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('bulk-delete-two-accepted', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_removed', '2026-01-01T00-00-00-000Z-route-bulk-delete-draft-only'), makePack({
    packId: 'route-bulk-delete-draft-only',
    title: 'Route Bulk Delete Draft Only',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('bulk-delete-draft-removed', 'approved')]
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
  const uploadsBefore = snapshotFiles(path.join(tempRoot, 'uploads'));
  const nonSelectedBefore = readKnowledgePack(approvedPacksDir, 'route-bulk-keep-pack');
  const response = await request(handlers, 'DELETE', '/approved', {
    packIds: ['route-bulk-delete-pack-one', 'route-bulk-delete-pack-two', 'route-bulk-delete-draft-only'],
    confirmed: true
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.deletedCount, 3);
  assert.deepEqual(response.body.data.deletedPackIds, ['route-bulk-delete-pack-one', 'route-bulk-delete-pack-two', 'route-bulk-delete-draft-only']);
  assert.equal(response.body.data.sourceFilesPreserved, true);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-delete-pack-one', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-delete-pack-two', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, 'route-bulk-delete-pack-two', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, 'route-bulk-delete-draft-only', 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, '_accepted', '2026-01-01T00-00-00-000Z-route-bulk-delete-pack-two', 'route-bulk-delete-pack-two', 'knowledge_pack.json')), true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, '_removed', '2026-01-01T00-00-00-000Z-route-bulk-delete-draft-only', 'route-bulk-delete-draft-only', 'knowledge_pack.json')), true);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-keep-pack', 'knowledge_pack.json')), true);
  assert.deepEqual(readKnowledgePack(approvedPacksDir, 'route-bulk-keep-pack'), nonSelectedBefore, 'non-selected approved pack should remain untouched');
  assert.equal(response.body.data.deletions.length, 3);
  response.body.data.deletions.forEach((deletion) => {
    assert.deepEqual(deletion.errors, []);
    assert.equal(Array.isArray(deletion.deleted), true);
    assert.equal(deletion.deleted.length > 0, true);
  });
  const activationState = JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(activationState.packs, 'route-bulk-delete-pack-one'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(activationState.packs, 'route-bulk-delete-pack-two'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(activationState.packs, 'route-bulk-delete-draft-only'), false);
  assert.equal(activationState.packs['route-bulk-keep-pack'].enabled, true);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-delete-pack-one'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-delete-pack-two'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-delete-draft-only'), false);
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === 'route-bulk-keep-pack'), true);
  const draftsResponse = await request(handlers, 'GET', '/drafts');
  assert.equal(draftsResponse.body.data.draftPacks.some((pack) => pack.packId === 'route-bulk-delete-draft-only'), false, 'bulk delete should remove selected draft rows from the visible list.');
  assert.equal(draftsResponse.body.data.draftPacks.some((pack) => pack.packId === 'route-bulk-keep-pack'), false, 'approved rows should never reappear as draft rows.');
  assert.deepEqual(snapshotFiles(path.join(tempRoot, 'uploads')), uploadsBefore, 'bulk delete should not remove uploaded source files');
}

async function assertApprovedBulkDeleteRequiresConfirmation(handlers) {
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-bulk-confirm-required-pack',
    title: 'Route Bulk Confirm Required Pack',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('bulk-confirm-required', 'approved')]
  }));
  const response = await request(handlers, 'DELETE', '/approved', {
    packIds: ['route-bulk-confirm-required-pack']
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /confirmed must be true/);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-bulk-confirm-required-pack', 'knowledge_pack.json')), true);
}

async function assertDeleteAllRemovesEveryVisiblePack(handlers) {
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: 'route-delete-all-approved-visible',
    title: 'Route Delete All Approved Visible',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('route-delete-all-approved-visible', 'approved')]
  }));
  writeKnowledgePack(draftPacksDir, makePack({
    packId: 'route-delete-all-draft-visible',
    title: 'Route Delete All Draft Visible',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-delete-all-draft-visible', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_removed', '2026-01-01T00-00-00-000Z-route-delete-all-draft-visible'), makePack({
    packId: 'route-delete-all-draft-visible',
    title: 'Route Delete All Draft Visible',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-delete-all-draft-removed-visible', 'approved')]
  }));
  const uploadsBefore = snapshotFiles(path.join(tempRoot, 'uploads'));
  const beforeDashboard = await request(handlers, 'GET', '/dashboard');
  const visiblePackIds = new Set();
  const approvedResponse = await request(handlers, 'GET', '/approved');
  (approvedResponse.body.data.approvedPacks || []).forEach((pack) => {
    if (pack && pack.packId) visiblePackIds.add(pack.packId);
  });
  const draftsResponse = await request(handlers, 'GET', '/drafts');
  (draftsResponse.body.data.draftPacks || []).forEach((pack) => {
    if (pack && pack.packId) visiblePackIds.add(pack.packId);
  });
  const packIds = Array.from(visiblePackIds).sort();
  const response = await request(handlers, 'DELETE', '/approved', {
    packIds,
    confirmed: true
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.deletedCount, packIds.length, 'delete all should remove every visible pack ID.');
  const afterDashboard = await request(handlers, 'GET', '/dashboard');
  const afterApproved = await request(handlers, 'GET', '/approved');
  const afterDrafts = await request(handlers, 'GET', '/drafts');
  const visibleAfterDeleteAll = new Set([
    ...(afterApproved.body.data.approvedPacks || []).map((pack) => pack && pack.packId).filter(Boolean),
    ...(afterDrafts.body.data.draftPacks || []).map((pack) => pack && pack.packId).filter(Boolean)
  ]);
  assert.equal(afterDashboard.statusCode, 200);
  assert.equal(afterDashboard.body.data.approvedPacks, 0, 'delete all should clear visible approved packs.');
  packIds.forEach((packId) => {
    assert.equal(
      visibleAfterDeleteAll.has(packId),
      false,
      `delete all should remove packId ${packId} from the visible saved knowledge lists.`
    );
  });
  assert.equal(beforeDashboard.body.data.approvedPacks + beforeDashboard.body.data.draftPacks > 0, true, 'setup should include visible packs before delete all.');
  assert.deepEqual(snapshotFiles(path.join(tempRoot, 'uploads')), uploadsBefore, 'delete all should not remove uploaded source files');
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
    confirmed: true
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.errors[0], /packIds/);
  assert.deepEqual(snapshotFiles(approvedPacksDir), approvedBefore, 'invalid bulk delete should not modify approved packs');
  assert.deepEqual(snapshotFiles(deletedApprovedPacksDir), deletedBefore, 'invalid bulk delete should not archive any packs');
  assert.deepEqual(snapshotFiles(draftPacksDir), draftBefore, 'invalid bulk delete should not modify draft packs');
}

async function assertDraftOnlyDeleteRemovesPackFromVisibleList(handlers) {
  const packId = 'route-draft-only-delete-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Draft Only Delete Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-draft-only-delete', 'approved')]
  }));
  writeKnowledgePack(path.join(draftPacksDir, '_accepted', `2026-01-01T00-00-00-000Z-${packId}`), makePack({
    packId,
    title: 'Route Draft Only Delete Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-draft-only-delete-accepted', 'approved')]
  }));

  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmed: true
  }, {
    packId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(draftPacksDir, '_accepted', `2026-01-01T00-00-00-000Z-${packId}`, packId, 'knowledge_pack.json')), true);
  const draftsResponse = await request(handlers, 'GET', '/drafts');
  assert.equal(draftsResponse.body.data.draftPacks.some((pack) => pack.packId === packId), false, 'deleted draft pack should be removed from visible list after refresh.');
}

async function assertDeleteByPackIdDoesNotRemoveSimilarTitlePack(handlers) {
  const targetPackId = 'route-similar-title-target';
  const keepPackId = 'route-similar-title-keep';
  writeKnowledgePack(draftPacksDir, makePack({
    packId: targetPackId,
    title: 'Forces Unit 1',
    version: '0.1.0-draft',
    vocabulary: [makeVocabularyItem('route-similar-title-target', 'approved')]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: keepPackId,
    title: 'Forces Unit 1',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('route-similar-title-keep', 'approved')]
  }));

  const response = await request(handlers, 'DELETE', '/approved/:packId', {
    confirmed: true
  }, {
    packId: targetPackId
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, targetPackId, 'knowledge_pack.json')), false);
  assert.equal(fs.existsSync(path.join(approvedPacksDir, keepPackId, 'knowledge_pack.json')), true);
}

async function assertPromoteDraftEndpointSucceeds(handlers) {
  const beforeDashboard = await request(handlers, 'GET', '/dashboard');
  const beforeDraftCount = beforeDashboard.body.data.draftPacks;
  const beforeApprovedCount = beforeDashboard.body.data.approvedPacks;
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
  assert.equal(response.body.data.activation.activationEnabled, true, 'draft promotion should enable activation immediately.');
  assert.equal(response.body.data.approved.activationEnabled, true, 'newly approved packs should be available to student answers.');
  assert.equal(response.body.data.approved.activationStatus, 'enabled');
  assert.equal(response.body.data.approvedSummary.approvedPacks.find((pack) => pack.packId === 'route-promote-ready-pack').activationEnabled, true);
  assert.equal(JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8')).packs['route-promote-ready-pack'].enabled, true);
  assert.equal(response.body.data.dashboard.draftPacks, beforeDraftCount, 'active draft count should drop back after source draft is archived.');
  assert.equal(response.body.data.dashboard.approvedPacks, beforeApprovedCount + 1, 'approved count should increase after promotion.');
  assert.ok(response.body.data.outputPath.startsWith(approvedPacksDir));
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'route-promote-ready-pack', 'knowledge_pack.json')), true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, 'route-promote-ready-pack', 'knowledge_pack.json')), false, 'source draft should leave active draft-packs after promotion.');
  assert.ok(response.body.data.archivedDraft.archivedPath.startsWith(path.join(draftPacksDir, '_accepted')), 'source draft should be archived under _accepted.');
  assert.equal(fs.existsSync(path.join(response.body.data.archivedDraft.archivedPath, 'knowledge_pack.json')), true, 'archived draft copy should be preserved.');
  assert.equal(Array.isArray(response.body.data.drafts), true, 'promotion should return refreshed active drafts.');
  assert.equal(response.body.data.drafts.some((pack) => pack.packId === 'route-promote-ready-pack'), false, 'promoted draft should not reload into active review queue.');
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

async function assertApprovedOnlyPromotionIgnoresUnselectedPendingItems(handlers) {
  const packId = 'route-promote-approved-only-pending-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      makeVocabularyItem('approved-route-term', 'approved'),
      makeVocabularyItem('pending-route-term', 'pending')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {
    promotionMode: 'approvedOnly'
  }, { packId });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  const promoted = readKnowledgePack(approvedPacksDir, packId);
  assert.deepEqual(promoted.vocabulary.map((item) => item.term), ['approved-route-term']);
  assert.equal(JSON.stringify(promoted).includes('pending-route-term'), false);
}

async function assertSelectedOnlyPromotionUsesOnlySelectedRows(handlers) {
  const packId = 'route-promote-selected-only-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [makeVocabularyItem('selected-route-term', 'approved')],
    concepts: [makeConceptItem('unselected-route-concept', 'approved')],
    referenceFormulas: [
      {
        ...makeReferenceFormula('pending-route-formula', 'pending')
      }
    ],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/drafts/:packId/promote', {
    promotionMode: 'selectedOnly',
    selectedItems: [{ section: 'vocabulary', index: 0 }]
  }, { packId });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  const promoted = readKnowledgePack(approvedPacksDir, packId);
  assert.deepEqual(promoted.vocabulary.map((item) => item.term), ['selected-route-term']);
  assert.deepEqual(promoted.concepts, []);
  assert.deepEqual(promoted.referenceFormulas, []);
}

async function assertCombinedApproveAllValidAcrossMultipleDrafts(handlers) {
  const packOneId = 'route-combined-all-pack-one';
  const packTwoId = 'route-combined-all-pack-two';
  writeKnowledgePack(draftPacksDir, makePack({
    packId: packOneId,
    title: 'Combined Source One',
    vocabulary: [
      makeVocabularyItem('combined-all-valid-one', 'pending'),
      makeVocabularyItem('combined-all-rejected', 'rejected'),
      {
        ...makeVocabularyItem('combined-all-blocked', 'approved'),
        sourceTextSnippet: ''
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
  writeKnowledgePack(draftPacksDir, makePack({
    packId: packTwoId,
    title: 'Combined Source Two',
    vocabulary: [],
    concepts: [makeConceptItem('combined-all-concept-valid', 'pending')],
    referenceFormulas: [],
    problemBank: [makeProblemItem('combined-all-problem-valid', 'approved')],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'all_valid',
    reviewBatchName: 'Combined Batch Alpha',
    reviewBatchPackIds: [packOneId, packTwoId],
    rows: [
      { draftPackId: packOneId, section: 'vocabulary', index: 0 },
      { draftPackId: packOneId, section: 'vocabulary', index: 1 },
      { draftPackId: packOneId, section: 'vocabulary', index: 2 },
      { draftPackId: packTwoId, section: 'concepts', index: 0 },
      { draftPackId: packTwoId, section: 'problemBank', index: 0 }
    ]
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.acceptedCount, 3, 'only valid visible rows should be accepted.');
  assert.equal(response.body.data.skipped.rejected, 1, 'rejected rows should be skipped.');
  assert.equal(response.body.data.skipped.blocked, 1, 'blocking rows should be skipped.');

  const combinedPackId = response.body.data.combinedPack.packId;
  const combined = readKnowledgePack(approvedPacksDir, combinedPackId);
  assert.equal(Array.isArray(combined.vocabulary), true);
  assert.equal(combined.vocabulary.some((item) => item.term === 'combined-all-valid-one'), true);
  assert.equal(combined.vocabulary.some((item) => item.term === 'combined-all-rejected'), false);
  assert.equal(combined.vocabulary.some((item) => item.term === 'combined-all-blocked'), false);
  assert.equal(combined.concepts.some((item) => item.conceptId === 'combined-all-concept-valid'), true);
  assert.equal(combined.problemBank.some((item) => item.problemId === 'combined-all-problem-valid'), true);
  assert.equal(combined.metadata.combinedApproval.reviewBatchName, 'Combined Batch Alpha');
  assert.equal(Array.isArray(combined.metadata.combinedApproval.sourceDraftPackIds), true);

  const remainingPackOne = readKnowledgePack(draftPacksDir, packOneId);
  assert.equal(remainingPackOne.vocabulary.some((item) => item.term === 'combined-all-valid-one'), false, 'accepted rows should be cleared from the draft queue.');
  assert.equal(remainingPackOne.vocabulary.some((item) => item.term === 'combined-all-rejected'), true, 'excluded rows should remain excluded.');
  assert.equal(remainingPackOne.vocabulary.some((item) => item.term === 'combined-all-blocked'), true, 'blocking rows should remain for later review.');
  assert.equal(
    Array.isArray(response.body.data.archivedDrafts) && response.body.data.archivedDrafts.some((entry) => entry.packId === packTwoId),
    true,
    'all-valid combined approval may archive a source draft once accepted rows are fully cleared.'
  );
  const archivedPackTwo = response.body.data.archivedDrafts.find((entry) => entry.packId === packTwoId);
  assert.ok(String(archivedPackTwo.archivedPath || '').startsWith(path.join(draftPacksDir, '_accepted')), 'fully accepted all-valid drafts should archive under _accepted.');
  const draftsAfter = await request(handlers, 'GET', '/drafts');
  assert.equal(draftsAfter.body.data.draftPacks.some((pack) => pack.packId === packTwoId), false, 'archived source drafts should leave the active review queue.');
}

async function assertCombinedApproveSelectedAcrossMultipleDrafts(handlers) {
  const packOneId = 'route-combined-selected-pack-one';
  const packTwoId = 'route-combined-selected-pack-two';
  writeKnowledgePack(draftPacksDir, makePack({
    packId: packOneId,
    title: 'Combined Select One',
    vocabulary: [
      makeVocabularyItem('combined-selected-accepted', 'pending'),
      makeVocabularyItem('combined-selected-unselected', 'pending')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
  writeKnowledgePack(draftPacksDir, makePack({
    packId: packTwoId,
    title: 'Combined Select Two',
    vocabulary: [],
    concepts: [makeConceptItem('combined-selected-concept', 'pending')],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Combined Batch Beta',
    reviewBatchPackIds: [packOneId, packTwoId],
    rows: [
      { draftPackId: packOneId, section: 'vocabulary', index: 0 },
      { draftPackId: packTwoId, section: 'concepts', index: 0 }
    ]
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.acceptedCount, 2);
  const combinedPackId = response.body.data.combinedPack.packId;
  const combined = readKnowledgePack(approvedPacksDir, combinedPackId);
  assert.equal(combined.vocabulary.some((item) => item.term === 'combined-selected-accepted'), true);
  assert.equal(combined.vocabulary.some((item) => item.term === 'combined-selected-unselected'), false, 'unselected rows must not be accepted.');
  assert.equal(combined.concepts.some((item) => item.conceptId === 'combined-selected-concept'), true);

  const remainingPackOne = readKnowledgePack(draftPacksDir, packOneId);
  assert.equal(remainingPackOne.vocabulary.some((item) => item.term === 'combined-selected-accepted'), false, 'selected accepted rows should clear from the queue.');
  assert.equal(remainingPackOne.vocabulary.some((item) => item.term === 'combined-selected-unselected'), true, 'unselected rows should stay for later review.');
  assert.equal(
    Array.isArray(response.body.data.archivedDrafts) && response.body.data.archivedDrafts.some((entry) => entry.packId === packTwoId),
    true,
    'selected combined approval should archive source drafts that are fully emptied by accepted rows.'
  );
  const archivedPackTwo = response.body.data.archivedDrafts.find((entry) => entry.packId === packTwoId);
  assert.ok(String(archivedPackTwo.archivedPath || '').startsWith(path.join(draftPacksDir, '_accepted')), 'fully accepted selected drafts should archive under _accepted.');
  assert.equal(fs.existsSync(path.join(draftPacksDir, packTwoId, 'knowledge_pack.json')), false, 'fully accepted source draft should be archived from active draft-packs.');
}

async function assertCombinedApproveSelectedAllowsTeacherVerifiedLowConfidenceRows(handlers) {
  const packId = 'route-combined-selected-low-confidence-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Combined Low Confidence',
    vocabulary: [
      {
        ...makeVocabularyItem('DNA', 'pending'),
        studentDefinition: 'Molecule that stores genetic instructions.',
        confidence: 'low',
        sourceGrounding: {
          status: 'supported',
          termOrTitleFound: true,
          explanationSupported: true
        }
      },
      makeVocabularyItem('gene', 'pending')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Combined Low Confidence Batch',
    reviewBatchPackIds: [packId],
    rows: [
      { draftPackId: packId, section: 'vocabulary', index: 0 }
    ]
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.acceptedCount, 1);
  assert.equal(response.body.data.skipped.blocked, 0, 'low-confidence-only selected rows should be teacher-verifiable on acceptance.');
  const combinedPackId = response.body.data.combinedPack.packId;
  const combined = readKnowledgePack(approvedPacksDir, combinedPackId);
  assert.equal(response.body.data.activation.activationEnabled, true, 'selected combined approval should enable activation immediately.');
  const activation = JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8'));
  assert.equal(activation.packs[combinedPackId].enabled, true, 'selected combined approval should persist enabled activation.');
  assert.equal(response.body.data.approvedSummary.approvedPacks.find((pack) => pack.packId === combinedPackId).activationEnabled, true);

  const acceptedDna = combined.vocabulary.find((item) => item.term === 'DNA');
  assert.ok(acceptedDna, 'selected low-confidence row should be in the combined pack.');
  assert.equal(acceptedDna.teacherVerified, true, 'selected low-confidence row should be stamped as teacher verified.');
  assert.equal(String(acceptedDna.confidenceOverride || '').toLowerCase(), 'teacher_verified');

  const enabledApproved = loadEnabledApprovedKnowledgeItems({ approvedPacksDir });
  assert.equal(enabledApproved.some((item) => item.title === 'DNA'), true, 'enabled approved loader should include the selected approved DNA row.');

  const remainingDraft = readKnowledgePack(draftPacksDir, packId);
  assert.equal(remainingDraft.vocabulary.some((item) => item.term === 'DNA'), false, 'accepted selected row should be removed from active draft queue.');
  assert.equal(remainingDraft.vocabulary.some((item) => item.term === 'gene'), true, 'unselected rows should remain in draft queue.');
  assert.equal(response.body.data.archivedDrafts.length, 0, 'drafts with unselected visible rows should remain active instead of being archived.');
}

async function assertCombinedApproveSelectedStillBlocksMissingRequiredOrUnsafeRows(handlers) {
  const packId = 'route-combined-selected-blocked-rows-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Combined Blocked Rows',
    vocabulary: [
      {
        ...makeVocabularyItem('codon', 'pending'),
        confidence: 'low',
        sourceGrounding: {
          status: 'supported',
          termOrTitleFound: true,
          explanationSupported: true
        }
      },
      {
        ...makeVocabularyItem('sequence-notes', 'pending'),
        sourceTextSnippet: ''
      },
      {
        ...makeVocabularyItem('depending-on-the-situation', 'pending'),
        repairStatus: 'repair_failed'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Combined Blocked Rows Batch',
    reviewBatchPackIds: [packId],
    rows: [
      { draftPackId: packId, section: 'vocabulary', index: 0 },
      { draftPackId: packId, section: 'vocabulary', index: 1 },
      { draftPackId: packId, section: 'vocabulary', index: 2 }
    ]
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.acceptedCount, 1, 'only low-confidence-only selected row should pass.');
  assert.equal(response.body.data.skipped.blocked, 2, 'rows with real blockers must still be blocked.');
  const combinedPackId = response.body.data.combinedPack.packId;
  const combined = readKnowledgePack(approvedPacksDir, combinedPackId);
  assert.equal(combined.vocabulary.some((item) => item.term === 'codon'), true);
  assert.equal(combined.vocabulary.some((item) => item.term === 'sequence-notes'), false, 'missing-source rows must remain blocked.');
  assert.equal(combined.vocabulary.some((item) => item.term === 'depending-on-the-situation'), false, 'repair-failed rows must remain blocked.');

  const remainingDraft = readKnowledgePack(draftPacksDir, packId);
  assert.equal(remainingDraft.vocabulary.some((item) => item.term === 'codon'), false);
  assert.equal(remainingDraft.vocabulary.some((item) => item.term === 'sequence-notes'), true);
  assert.equal(remainingDraft.vocabulary.some((item) => item.term === 'depending-on-the-situation'), true);
}

async function assertCombinedApproveDedupesAndUpdatesExistingItem(handlers) {
  const packId = 'route-combined-dedupe-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Combined Dedupe Source',
    vocabulary: [
      {
        ...makeVocabularyItem('combined-dedupe-term', 'pending'),
        studentDefinition: 'Version one says net force is the total force on an object.'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const first = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Combined Batch Gamma',
    reviewBatchPackIds: [packId],
    rows: [
      { draftPackId: packId, section: 'vocabulary', index: 0 }
    ]
  });
  assert.equal(first.statusCode, 200, JSON.stringify(first.body));
  const combinedPackId = first.body.data.combinedPack.packId;
  const afterFirst = readKnowledgePack(approvedPacksDir, combinedPackId);
  assert.equal(afterFirst.vocabulary.filter((item) => item.term === 'combined-dedupe-term').length, 1);
  assert.equal(
    afterFirst.vocabulary.find((item) => item.term === 'combined-dedupe-term').studentDefinition,
    'Version one says net force is the total force on an object.'
  );

  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Combined Dedupe Source',
    vocabulary: [
      {
        ...makeVocabularyItem('combined-dedupe-term', 'pending'),
        studentDefinition: 'Version two says net force is the sum of all forces acting on an object.'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const second = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Combined Batch Gamma',
    reviewBatchPackIds: [packId],
    rows: [
      { draftPackId: packId, section: 'vocabulary', index: 0 }
    ]
  });
  assert.equal(second.statusCode, 200, JSON.stringify(second.body));
  assert.equal(second.body.data.combinedPack.packId, combinedPackId, 'repeat accepts should merge into the same combined pack.');
  const afterSecond = readKnowledgePack(approvedPacksDir, combinedPackId);
  const dedupedRows = afterSecond.vocabulary.filter((item) => item.term === 'combined-dedupe-term');
  assert.equal(dedupedRows.length, 1, 'same section + same term should not duplicate.');
  assert.equal(
    dedupedRows[0].studentDefinition,
    'Version two says net force is the sum of all forces acting on an object.',
    'later edited data should replace stale values when accepted again.'
  );
}

async function assertCombinedApproveSelectedArchivesEmptiedDraftWhenApprovedPackIdDiffers(handlers) {
  const draftPackId = 'draft-route-combined-selected-archive-real-case';
  const sharedTitle = 'Charlemagne Test 02 Medium 10 Slide Motion Forces';
  writeKnowledgePack(draftPacksDir, makePack({
    packId: draftPackId,
    title: sharedTitle,
    sourceFiles: [],
    metadata: {},
    vocabulary: [makeVocabularyItem('combined-selected-archive-term', 'pending')],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: sharedTitle,
    reviewBatchPackIds: [draftPackId],
    rows: [
      { draftPackId, section: 'vocabulary', index: 0 }
    ]
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  const combinedPackId = String(response.body.data.combinedPack.packId || '');
  assert.notEqual(combinedPackId, draftPackId, 'combined approval should create a distinct approved pack ID.');
  assert.equal(String(response.body.data.combinedPack.title || ''), sharedTitle, 'approved combined pack should preserve the teacher-facing title.');
  assert.equal(
    Array.isArray(response.body.data.archivedDrafts) && response.body.data.archivedDrafts.some((entry) => entry.packId === draftPackId),
    true,
    'selected combined approval should archive a draft that is fully emptied by accepted rows.'
  );
  const archivedDraft = response.body.data.archivedDrafts.find((entry) => entry.packId === draftPackId);
  assert.ok(String(archivedDraft.archivedPath || '').startsWith(path.join(draftPacksDir, '_accepted')), 'fully accepted selected draft should archive under _accepted even when the approved pack ID differs.');
  assert.equal(fs.existsSync(path.join(draftPacksDir, draftPackId, 'knowledge_pack.json')), false, 'emptied draft should be archived from active draft-packs.');
  assert.equal(fs.existsSync(path.join(approvedPacksDir, combinedPackId, 'knowledge_pack.json')), true, 'approved combined pack should remain saved.');

  const drafts = await request(handlers, 'GET', '/drafts');
  assert.equal(drafts.statusCode, 200, JSON.stringify(drafts.body));
  assert.equal(drafts.body.data.draftPacks.some((pack) => pack.packId === draftPackId), false, 'archived accepted draft should not remain in the active draft summary.');
}

async function assertCombinedApproveRejectsUnsafePackIds(handlers) {
  const beforeApproved = snapshotKnowledgePackFiles(approvedPacksDir);
  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'selected',
    reviewBatchName: 'Unsafe Combined Batch',
    rows: [
      { draftPackId: '../unsafe-pack', section: 'vocabulary', index: 0 }
    ]
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.deepEqual(snapshotKnowledgePackFiles(approvedPacksDir), beforeApproved, 'unsafe combined approval rows should not mutate approved packs.');
}

async function assertFinalPublishUsesDraftPackIdOnlyAndArchivesDraft(handlers) {
  const packId = 'route-final-publish-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Final Publish Pack',
    vocabulary: [
      makeVocabularyItem('final-publish-valid-term', 'pending'),
      makeVocabularyItem('final-publish-needs-review-term', 'needs_review'),
      {
        ...makeVocabularyItem('final-publish-low-confidence-term', 'approved'),
        confidence: 'low'
      },
      {
        ...makeVocabularyItem('final-publish-missing-source-term', 'pending'),
        sourceFile: '',
        sourceLocation: '',
        sourceTextSnippet: ''
      },
      {
        ...makeVocabularyItem('final-publish-weak-grounding-term', 'pending'),
        sourceGrounding: {
          status: 'unsupported',
          termOrTitleFound: false,
          explanationSupported: false
        }
      },
      makeVocabularyItem('final-publish-rejected-term', 'rejected')
    ],
    concepts: [makeConceptItem('final-publish-valid-concept', 'pending')],
    referenceFormulas: [
      {
        ...makeReferenceFormula('final-publish-invalid-formula', 'approved'),
        validationStatus: 'invalid'
      }
    ],
    problemBank: [makeProblemItem('final-publish-valid-problem', 'approved')],
    standardsMap: [
      {
        ...makeStandardsMapItem('SAMPLE.PS.FORCES.2', 'approved'),
        quarantineStatus: 'quarantined'
      }
    ],
    smokeTests: []
  }));

  const response = await request(handlers, 'POST', '/review/approve-combined', {
    mode: 'final_publish',
    draftPackId: packId
  });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.mode, 'final_publish');
  assert.equal(response.body.data.combinedPack.packId, packId);
  assert.equal(response.body.data.acceptedCount, 7, 'final publish should include structurally usable rows even when they are pending, needs_review, low-confidence, weak-grounding, or missing source fields.');
  assert.equal(response.body.data.skipped.blocked, 2);
  assert.equal(response.body.data.skipped.rejected, 1);
  assert.equal(response.body.data.activation.activationEnabled, true, 'final publish should enable activation for student answers.');

  const approved = readKnowledgePack(approvedPacksDir, packId);
  assert.deepEqual(approved.vocabulary.map((item) => item.term), [
    'final-publish-valid-term',
    'final-publish-needs-review-term',
    'final-publish-low-confidence-term',
    'final-publish-missing-source-term',
    'final-publish-weak-grounding-term'
  ]);
  assert.equal(approved.vocabulary.every((item) => item.reviewStatus === 'approved'), true, 'final publish should stamp accepted rows as approved.');
  assert.equal(JSON.stringify(approved).includes('final-publish-invalid-formula'), false, 'invalid rows should stay out of approved output.');
  assert.equal(JSON.stringify(approved).includes('SAMPLE.PS.FORCES.2'), false, 'quarantined rows should stay out of approved output.');
  assert.equal(JSON.stringify(approved).includes('final-publish-rejected-term'), false, 'rejected rows should stay out of approved output.');
  assert.equal(approved.vocabulary.some((item) => item.term === 'final-publish-low-confidence-term' && String(item.confidence) === 'low'), true, 'low-confidence metadata should be preserved on published rows.');
  assert.equal(approved.vocabulary.some((item) => item.term === 'final-publish-missing-source-term' && !item.sourceFile && !item.sourceLocation && !item.sourceTextSnippet), true, 'missing source metadata should not block final publish.');
  assert.equal(approved.vocabulary.some((item) => item.term === 'final-publish-weak-grounding-term' && item.sourceGrounding && item.sourceGrounding.status === 'unsupported'), true, 'weak source grounding metadata should be preserved on published rows.');
  assert.equal(approved.concepts.some((item) => item.conceptId === 'final-publish-valid-concept'), true);
  assert.equal(approved.problemBank.some((item) => item.problemId === 'final-publish-valid-problem'), true);

  const activation = JSON.parse(fs.readFileSync(activationRegistryPath, 'utf8'));
  assert.equal(activation.packs[packId].enabled, true, 'activation registry should mark final-published pack as enabled.');
  assert.equal(response.body.data.approvedSummary.approvedPacks.find((pack) => pack.packId === packId).activationEnabled, true);

  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false, 'final publish should archive/remove the active draft from draft-packs.');
  assert.equal(response.body.data.drafts.some((draft) => draft.packId === packId), false, 'final-published draft should disappear from active drafts summary.');
  assert.equal(response.body.data.draftSummary.draftPacks.some((draft) => draft.packId === packId), false, 'draftSummary should be refreshed after final publish.');
  const archived = response.body.data.archivedDrafts.find((entry) => entry.packId === packId);
  assert.ok(archived, 'final publish should return archived draft metadata.');
  assert.ok(String(archived.archivedPath || '').startsWith(path.join(draftPacksDir, '_removed')));
  const archivedCopy = JSON.parse(fs.readFileSync(path.join(archived.archivedPath, 'knowledge_pack.json'), 'utf8'));
  assert.equal(archivedCopy.referenceFormulas.some((item) => item.formulaId === 'final-publish-invalid-formula'), true, 'archived draft should preserve skipped/invalid rows for review history.');
  assert.equal(archivedCopy.standardsMap.some((item) => item.standardId === 'SAMPLE.PS.FORCES.2'), true, 'archived draft should preserve skipped/quarantined rows for review history.');
  assert.equal(archivedCopy.vocabulary.some((item) => item.term === 'final-publish-rejected-term'), true, 'archived draft should preserve rejected rows for review history.');
}

async function assertExistingDraftBlockersCanBeRejectedAndPromoted(handlers) {
  const packId = 'route-existing-blockers-promote-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Existing Blockers Promote Pack',
    vocabulary: [
      {
        ...makeVocabularyItem('blocked-approved-term', 'approved'),
        confidence: 'low',
        sourceGrounding: {
          status: 'unsupported',
          termOrTitleFound: false,
          explanationSupported: false
        }
      },
      makeVocabularyItem('valid-approved-term', 'approved')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const beforeDashboard = await request(handlers, 'GET', '/dashboard');
  const beforeDraftCount = beforeDashboard.body.data.draftPacks;
  const beforeApprovedCount = beforeDashboard.body.data.approvedPacks;

  const report = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
  assert.equal(report.statusCode, 200);
  assert.equal(report.body.data.pendingReview.totalPending, 0);
  assert.equal(report.body.data.reviewItems.items.vocabulary.length, 2);
  assert.equal(report.body.data.reviewItems.items.vocabulary[0].reviewStatus, 'approved');
  assert.equal(report.body.data.promotionReadiness.ready, false);
  assert.equal(report.body.data.promotionReadiness.blockerSummary.totalItems, 1);
  assert.equal(report.body.data.promotionReadiness.blockerSummary.categories.some((entry) => entry.category === 'missing required source information'), true);

  const blockedPromotion = await request(handlers, 'POST', '/drafts/:packId/promote', {}, { packId });
  assert.equal(blockedPromotion.statusCode, 400);
  assert.equal(blockedPromotion.body.success, false);
  assert.match(blockedPromotion.body.message, /1 item is blocking approval/);
  assert.ok(blockedPromotion.body.promotionReadiness.blockerSummary.message.includes('missing required source information'));

  const reject = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
    reviewStatus: 'rejected'
  }, {
    packId,
    section: 'vocabulary',
    index: '0'
  });
  assert.equal(reject.statusCode, 200);
  assert.equal(reject.body.success, true);
  assert.equal(reject.body.data.report.draftPack.reviewCounts.rejected, 1);

  const promotion = await request(handlers, 'POST', '/drafts/:packId/promote', {}, { packId });
  assert.equal(promotion.statusCode, 200);
  assert.equal(promotion.body.success, true);
  assert.equal(promotion.body.data.approved.packId, packId);
  assert.equal(promotion.body.data.activation.activationEnabled, true);
  assert.equal(promotion.body.data.approved.activationEnabled, true);
  assert.equal(promotion.body.data.approved.activationStatus, 'enabled');
  assert.equal(promotion.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === packId), true);
  assert.equal(promotion.body.data.dashboard.draftPacks, beforeDraftCount - 1, 'visible draft count should decrease after approval.');
  assert.equal(promotion.body.data.dashboard.approvedPacks, beforeApprovedCount + 1, 'approved count should increase after approval.');

  const promotedPack = JSON.parse(fs.readFileSync(path.join(approvedPacksDir, packId, 'knowledge_pack.json'), 'utf8'));
  assert.deepEqual(promotedPack.vocabulary.map((item) => item.term), ['valid-approved-term']);
  assert.equal(JSON.stringify(promotedPack).includes('blocked-approved-term'), false);

  const approvedLoad = loadApprovedKnowledgePacks({
    approvedPacksDir,
    validationOptions: { standardsBank, standardsPaused: true }
  });
  assert.equal(approvedLoad.packs.some((record) => record.packId === packId), true, 'approved loader should see the newly approved pack.');

  const drafts = await request(handlers, 'GET', '/drafts');
  assert.equal(drafts.body.data.draftPacks.some((pack) => pack.packId === packId), false, 'Knowledge blade draft list should no longer include the approved pack.');
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
  assert.equal(fs.existsSync(path.join(draftPacksDir, 'route-approved-pack', 'knowledge_pack.json')), false, 'force-promoted draft copy should be archived from active drafts.');
}

async function assertRemoveAcceptedDraftCopyArchivesDraftOnly(handlers) {
  const packId = 'route-remove-accepted-draft-copy';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Remove Accepted Draft Copy',
    vocabulary: [makeVocabularyItem('accepted-copy-term', 'approved')]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId,
    title: 'Route Remove Accepted Approved Pack',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('accepted-copy-term', 'approved')]
  }));

  const draftsBefore = await request(handlers, 'GET', '/drafts');
  assert.equal(draftsBefore.body.data.draftPacks.some((pack) => pack.packId === packId), false, 'drafts endpoint should hide active draft copies that already have an approved pack.');

  const response = await request(handlers, 'DELETE', '/drafts/:packId/accepted-copy', {}, { packId });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, packId);
  assert.equal(response.body.data.approvedPackPreserved, true);
  assert.equal(response.body.data.alreadyArchived, false);
  assert.ok(response.body.data.archivedPath.startsWith(path.join(draftPacksDir, '_accepted')));
  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false, 'accepted draft copy should be removed from active draft-packs.');
  assert.equal(fs.existsSync(path.join(response.body.data.archivedPath, 'knowledge_pack.json')), true, 'accepted draft copy should be archived for history.');
  assert.equal(fs.existsSync(path.join(approvedPacksDir, packId, 'knowledge_pack.json')), true, 'removing accepted draft copy must not delete approved pack.');
  assert.equal(response.body.data.drafts.some((pack) => pack.packId === packId), false, 'accepted draft copy should not reload into active review queue after removal.');
  assert.equal(response.body.data.approvedSummary.approvedPacks.some((pack) => pack.packId === packId), true, 'approved pack should remain visible.');

  const repeat = await request(handlers, 'DELETE', '/drafts/:packId/accepted-copy', {}, { packId });
  assert.equal(repeat.statusCode, 200);
  assert.equal(repeat.body.success, true);
  assert.equal(repeat.body.data.alreadyArchived, true, 'remove accepted draft copy should be safe and persistent after refresh.');
}

async function assertRemoveAcceptedDraftCopyFindsApprovedPackByJsonPackId(handlers) {
  const packId = 'route-approved-by-json-pack-id';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Draft Copy Matched By Json Pack Id',
    vocabulary: [makeVocabularyItem('json-pack-id-term', 'approved')]
  }));
  writeKnowledgePack(path.join(approvedPacksDir, 'folder-name-does-not-match'), makePack({
    packId,
    title: 'Route Approved Matched By Json Pack Id',
    version: '1.0.0',
    vocabulary: [makeVocabularyItem('json-pack-id-term', 'approved')]
  }));

  const response = await request(handlers, 'DELETE', '/drafts/:packId/accepted-copy', {}, { packId });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, packId);
  assert.equal(response.body.data.approvedPackPreserved, true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false, 'draft should be archived even when approved folder name differs.');
  assert.equal(fs.existsSync(path.join(approvedPacksDir, 'folder-name-does-not-match', packId, 'knowledge_pack.json')), true, 'approved pack with matching JSON packId should be preserved.');
}

async function assertRemoveAcceptedDraftCopyMatchesApprovedByBlankSourceTitleFallback(handlers) {
  const draftPackId = 'draft-route-remove-accepted-title-fallback';
  const approvedPackId = 'route-remove-accepted-title-fallback';
  const sharedTitle = 'Charlemagne Route Title Fallback Archive Case';

  writeKnowledgePack(draftPacksDir, makePack({
    packId: draftPackId,
    title: sharedTitle,
    sourceFiles: [],
    metadata: {},
    vocabulary: [makeVocabularyItem('title-fallback-draft-term', 'approved')]
  }));
  writeKnowledgePack(approvedPacksDir, makePack({
    packId: approvedPackId,
    title: sharedTitle,
    version: '1.0.0',
    sourceFiles: [],
    metadata: {},
    vocabulary: [makeVocabularyItem('title-fallback-approved-term', 'approved')]
  }));

  const draftsBefore = await request(handlers, 'GET', '/drafts');
  assert.equal(draftsBefore.statusCode, 200, JSON.stringify(draftsBefore.body));
  assert.equal(
    draftsBefore.body.data.draftPacks.some((pack) => pack.packId === draftPackId),
    false,
    'active draft summary should hide matched accepted drafts when title fallback identifies an approved counterpart.'
  );

  const response = await request(handlers, 'DELETE', '/drafts/:packId/accepted-copy', {}, { packId: draftPackId });

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, draftPackId);
  assert.equal(response.body.data.approvedPackPreserved, true);
  assert.equal(fs.existsSync(path.join(draftPacksDir, draftPackId, 'knowledge_pack.json')), false, 'title fallback match should archive the accepted draft copy even when pack IDs differ.');
  assert.equal(fs.existsSync(path.join(approvedPacksDir, approvedPackId, 'knowledge_pack.json')), true, 'title fallback match should keep the approved pack.');
}

async function assertDraftsEndpointHidesSourceUploadIdMatchedAcceptedDrafts(handlers) {
  const sharedUploadId = 'b00953c3-5437-4226-a4b1-54b1afa28d20';
  const draftPackId = 'draft-charlemagne-test-02-medium-10-slide-motion-forces-b00953c3-5437-4226-a4b1-54b1afa28d20';
  const approvedPackId = 'charlemagne-test-02-medium-10-slide-motion-forces-0308ba7ee8';
  const sharedTitle = 'Charlemagne Test 02 Medium 10 Slide Motion Forces';

  try {
    writeKnowledgePack(draftPacksDir, makePack({
      packId: draftPackId,
      title: sharedTitle,
      sourceFiles: [{
        fileName: 'charlemagne_02_motion_forces.pdf',
        fileType: 'pdf',
        reviewStatus: 'approved',
        confidence: 'high',
        uploadId: sharedUploadId
      }],
      vocabulary: [makeVocabularyItem('source-upload-overlap-draft-term', 'pending')]
    }));
    writeKnowledgePack(approvedPacksDir, makePack({
      packId: approvedPackId,
      title: sharedTitle,
      version: '1.0.0',
      sourceFiles: [{
        fileName: 'charlemagne_02_motion_forces.pdf',
        fileType: 'pdf',
        reviewStatus: 'approved',
        confidence: 'high',
        uploadId: sharedUploadId
      }],
      vocabulary: [makeVocabularyItem('source-upload-overlap-approved-term', 'approved')]
    }));

    const drafts = await request(handlers, 'GET', '/drafts');
    assert.equal(drafts.statusCode, 200, JSON.stringify(drafts.body));
    assert.equal(
      drafts.body.data.draftPacks.some((pack) => pack.packId === draftPackId),
      false,
      'active draft summary should hide drafts that match approved packs by source uploadId overlap.'
    );
    assert.equal(
      fs.existsSync(path.join(draftPacksDir, draftPackId, 'knowledge_pack.json')),
      true,
      'visibility dedupe should not archive a draft automatically when review rows still remain.'
    );
  } finally {
    fs.rmSync(path.join(draftPacksDir, draftPackId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, approvedPackId), { recursive: true, force: true });
  }
}

async function assertStaleDraftCanBeRemovedFromReviewQueueWithoutApprovedPack(handlers) {
  const packId = 'route-stale-review-queue-draft';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    title: 'Route Stale Review Queue Draft',
    vocabulary: [makeVocabularyItem('stale-review-term', 'rejected')]
  }));

  const acceptedCopy = await request(handlers, 'DELETE', '/drafts/:packId/accepted-copy', {}, { packId });
  assert.equal(acceptedCopy.statusCode, 409, 'accepted-copy archive should still require an approved counterpart.');

  const response = await request(handlers, 'DELETE', '/drafts/:packId/review-queue', {}, { packId });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.packId, packId);
  assert.equal(response.body.data.approvedPackPreserved, false);
  assert.equal(response.body.data.removedFromReviewQueue, true);
  assert.ok(response.body.data.archivedPath.startsWith(path.join(draftPacksDir, '_removed')));
  assert.equal(fs.existsSync(path.join(draftPacksDir, packId, 'knowledge_pack.json')), false, 'stale draft should be removed from active draft-packs.');
  assert.equal(fs.existsSync(path.join(response.body.data.archivedPath, 'knowledge_pack.json')), true, 'stale draft should be archived instead of deleted outright.');
  assert.equal(response.body.data.drafts.some((pack) => pack.packId === packId), false, 'stale draft should not reload into active review queue.');
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
  assert.equal(response.body.data.debug.routeHandler, 'PATCH /drafts/:packId/items/:section/:index/status');
  assert.equal(response.body.data.debug.request.reviewStatus, 'approved');
  assert.equal(response.body.data.debug.afterSnapshot.success, true);
  assert.equal(response.body.data.debug.afterSnapshot.item.reviewStatus, 'approved');
  assert.equal(response.body.data.debug.afterSnapshot.item.teacherVerified, true);
  assert.equal(readKnowledgePack(draftPacksDir, 'route-draft-pack').vocabulary[0].reviewStatus, 'approved');
  assert.equal(response.body.data.report.draftPack.reviewCountsBySection.vocabulary.approved, 2);
}

async function assertApproveNeedsReviewLowConfidenceItemEndpoint(handlers) {
  const packId = 'route-needs-review-approve-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('needs-review-term', 'needs_review'),
        confidence: 'low',
        sourceGrounding: { status: 'weak', termOrTitleFound: true, explanationSupported: false }
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const response = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved'
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(readKnowledgePack(draftPacksDir, packId).vocabulary[0].reviewStatus, 'approved');
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
  }
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

async function assertApproveDraftItemWithInlineEdits(handlers) {
  const packId = 'route-inline-approve-edits-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('inline-approve-edit-term', 'approved'),
        confidence: 'low',
        studentDefinition: 'Original stale wording.',
        sourceGrounding: { status: 'supported', termOrTitleFound: true, explanationSupported: true }
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const beforeReport = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(beforeReport.statusCode, 200);
    assert.equal(beforeReport.body.data.promotionReadiness.ready, false);
    assert.ok(beforeReport.body.data.promotionReadiness.blockedReasons.some((reason) => reason.includes('low confidence')));

    const approve = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved',
      edits: [
        {
          field: 'studentDefinition',
          value: 'Teacher-edited wording approved from one click.'
        }
      ]
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.success, true);
    assert.equal(approve.body.data.report.draftPacketItems.vocabulary[0].studentDefinition, 'Teacher-edited wording approved from one click.');
    assert.ok(Array.isArray(approve.body.data.update.editedFields));
    assert.ok(approve.body.data.update.editedFields.includes('studentDefinition'));
    assert.equal(approve.body.data.debug.request.reviewStatus, 'approved');
    assert.equal(approve.body.data.debug.request.edits[0].field, 'studentDefinition');
    assert.equal(approve.body.data.debug.afterSnapshot.item.studentDefinition, 'Teacher-edited wording approved from one click.');
    assert.equal(approve.body.data.debug.afterSnapshot.item.manuallyEdited, true);
    assert.equal(approve.body.data.debug.refreshedItem.teacherVerified, true);

    const editedDraft = readKnowledgePack(draftPacksDir, packId);
    assert.equal(editedDraft.vocabulary[0].studentDefinition, 'Teacher-edited wording approved from one click.');
    assert.equal(editedDraft.vocabulary[0].teacherVerified, true);
    assert.equal(editedDraft.vocabulary[0].manuallyEdited, true);
    assert.equal(editedDraft.vocabulary[0].reviewStatus, 'approved');
    assert.equal(editedDraft.vocabulary[0].confidenceOverride, 'teacher_verified');

    const afterReport = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(afterReport.statusCode, 200);
    assert.equal(afterReport.body.data.promotionReadiness.ready, true);
    assert.equal(afterReport.body.data.promotionReadiness.blockedReasons.some((reason) => reason.includes('low confidence')), false);
    assert.equal(afterReport.body.data.draftPacketItems.vocabulary[0].studentDefinition, 'Teacher-edited wording approved from one click.');

    const promotion = await request(handlers, 'POST', '/drafts/:packId/promote', {}, { packId });
    assert.equal(promotion.statusCode, 200);
    assert.equal(promotion.body.success, true);
    assert.equal(promotion.body.data.approved.activationEnabled, true);
    const promotedPack = readKnowledgePack(approvedPacksDir, packId);
    assert.equal(promotedPack.vocabulary[0].studentDefinition, 'Teacher-edited wording approved from one click.');
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertApproveDraftItemResolvesStableItemRefWhenIndexStale(handlers) {
  const packId = 'route-stable-item-ref-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('stale-index-first-term', 'pending'),
        sourceLocation: 'Page 1',
        sourceTextSnippet: 'First row source snippet.'
      },
      {
        ...makeVocabularyItem('stable-target-term', 'pending'),
        sourceLocation: 'Page 2',
        sourceTextSnippet: 'Second row source snippet.'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const approve = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved',
      edits: [
        {
          field: 'studentDefinition',
          value: 'Stable item reference wording explains net force as the total force on an object.'
        }
      ],
      itemRef: {
        itemId: 'stable-target-term',
        term: 'stable-target-term',
        sourceFile: 'teacher_force_notes.txt',
        sourceLocation: 'Page 2'
      }
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.success, true);
    assert.equal(approve.body.data.debug.request.requestedIndex, 0);
    assert.equal(approve.body.data.debug.request.index, 1);
    assert.equal(approve.body.data.debug.request.itemRef.term, 'stable-target-term');
    assert.equal(approve.body.data.debug.request.resolvedTarget.resolvedBy, 'itemRef');
    assert.equal(approve.body.data.debug.afterSnapshot.item.term, 'stable-target-term');
    assert.equal(approve.body.data.debug.afterSnapshot.item.reviewStatus, 'approved');
    assert.equal(approve.body.data.debug.afterSnapshot.item.studentDefinition, 'Stable item reference wording explains net force as the total force on an object.');

    const editedDraft = readKnowledgePack(draftPacksDir, packId);
    assert.equal(editedDraft.vocabulary[0].term, 'stale-index-first-term');
    assert.equal(editedDraft.vocabulary[0].reviewStatus, 'pending');
    assert.equal(editedDraft.vocabulary[1].term, 'stable-target-term');
    assert.equal(editedDraft.vocabulary[1].reviewStatus, 'approved');
    assert.equal(editedDraft.vocabulary[1].studentDefinition, 'Stable item reference wording explains net force as the total force on an object.');
    assert.equal(editedDraft.vocabulary[1].teacherVerified, true);
    assert.equal(editedDraft.vocabulary[1].manuallyEdited, true);
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertApproveDraftItemAfterFocusedEditRequiresRefreshedItemRef(handlers) {
  const packId = 'route-focused-edit-refresh-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('focused-edit-old-term', 'pending'),
        sourceLocation: 'Page 8',
        sourceTextSnippet: 'Focused editor source snippet.'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const oldItemRef = {
      itemId: 'focused-edit-old-term',
      term: 'focused-edit-old-term',
      sourceFile: 'teacher_force_notes.txt',
      sourceLocation: 'Page 8'
    };
    const edit = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
      field: 'term',
      value: 'focused-edit-new-term',
      itemRef: oldItemRef
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(edit.statusCode, 200);
    assert.equal(edit.body.success, true);
    assert.equal(edit.body.data.debug.refreshedItem.itemId, 'focused-edit-new-term');

    const staleApprove = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved',
      itemRef: oldItemRef
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(staleApprove.statusCode, 409);
    assert.equal(staleApprove.body.success, false);
    assert.ok(staleApprove.body.errors.some((error) => error.includes('selected draft item changed')));

    const refreshedItemRef = {
      ...oldItemRef,
      itemId: 'focused-edit-new-term',
      term: 'focused-edit-new-term'
    };
    const approve = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved',
      itemRef: refreshedItemRef
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(approve.statusCode, 200);
    assert.equal(approve.body.success, true);
    assert.equal(approve.body.data.debug.request.itemRef.term, 'focused-edit-new-term');
    assert.equal(approve.body.data.debug.afterSnapshot.item.term, 'focused-edit-new-term');
    assert.equal(approve.body.data.debug.afterSnapshot.item.reviewStatus, 'approved');
    assert.equal(readKnowledgePack(draftPacksDir, packId).vocabulary[0].reviewStatus, 'approved');
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertTeacherEditClearsLowConfidencePromotionBlock(handlers) {
  const packId = 'route-teacher-edit-low-confidence-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('teacher-edit-low-confidence-term', 'approved'),
        confidence: 'low',
        studentDefinition: 'Original blocked wording.',
        sourceGrounding: { status: 'supported', termOrTitleFound: true, explanationSupported: true }
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const beforeReport = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(beforeReport.statusCode, 200);
    assert.equal(beforeReport.body.data.promotionReadiness.ready, false);
    assert.ok(beforeReport.body.data.promotionReadiness.blockedReasons.some((reason) => reason.includes('low confidence')));

    const edit = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index', {
      field: 'studentDefinition',
      value: 'Teacher-edited approved wording explains net force as the sum of forces on an object.'
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(edit.statusCode, 200);
    assert.equal(edit.body.success, true);
    assert.equal(edit.body.data.report.draftPacketItems.vocabulary[0].studentDefinition, 'Teacher-edited approved wording explains net force as the sum of forces on an object.');
    const editedDraft = readKnowledgePack(draftPacksDir, packId);
    assert.equal(editedDraft.vocabulary[0].teacherVerified, true);
    assert.equal(editedDraft.vocabulary[0].manuallyEdited, true);

    const afterReport = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(afterReport.statusCode, 200);
    assert.equal(afterReport.body.data.promotionReadiness.ready, true);
    assert.equal(afterReport.body.data.promotionReadiness.blockedReasons.some((reason) => reason.includes('low confidence')), false);

    const promotion = await request(handlers, 'POST', '/drafts/:packId/promote', {}, { packId });
    assert.equal(promotion.statusCode, 200);
    assert.equal(promotion.body.success, true);
    assert.equal(promotion.body.data.approved.activationEnabled, true);
    const promotedPack = readKnowledgePack(approvedPacksDir, packId);
    assert.equal(promotedPack.vocabulary[0].studentDefinition, 'Teacher-edited approved wording explains net force as the sum of forces on an object.');
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, packId), { recursive: true, force: true });
  }
}

async function assertTeacherEditStillBlockedWhenRequiredFieldsRemainMissing(handlers) {
  const packId = 'route-teacher-edit-missing-required-pack';
  writeKnowledgePack(draftPacksDir, makePack({
    packId,
    vocabulary: [
      {
        ...makeVocabularyItem('teacher-edit-missing-source-term', 'approved'),
        confidence: 'medium',
        sourceTextSnippet: '',
        sourceGrounding: { status: 'supported', termOrTitleFound: true, explanationSupported: true }
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  try {
    const approve = await request(handlers, 'PATCH', '/drafts/:packId/items/:section/:index/status', {
      reviewStatus: 'approved',
      edits: [
        {
          field: 'studentDefinition',
          value: 'Teacher edited wording but required source text is still missing.'
        }
      ]
    }, {
      packId,
      section: 'vocabulary',
      index: '0'
    });

    assert.equal(approve.statusCode, 400);
    assert.equal(approve.body.success, false);
    assert.ok(approve.body.errors.some((error) => error.includes('sourceTextSnippet')));
    assert.equal(approve.body.debug.routeHandler, 'PATCH /drafts/:packId/items/:section/:index/status');
    assert.equal(approve.body.debug.request.reviewStatus, 'approved');
    assert.equal(approve.body.debug.afterSnapshot.item.sourceTextSnippetLength, 0);

    const report = await request(handlers, 'GET', '/drafts/:packId/report', {}, { packId });
    assert.equal(report.statusCode, 200);
    assert.equal(report.body.data.promotionReadiness.ready, false);

    const promotion = await request(handlers, 'POST', '/drafts/:packId/promote', {}, { packId });
    assert.equal(promotion.statusCode, 400);
    assert.equal(promotion.body.success, false);
    assert.ok(Array.isArray(promotion.body.promotionReadiness.blockedReasons));
    assert.ok(promotion.body.promotionReadiness.blockedReasons.some((reason) => /source|required|ground/i.test(reason)));
  } finally {
    fs.rmSync(path.join(draftPacksDir, packId), { recursive: true, force: true });
    fs.rmSync(path.join(approvedPacksDir, packId), { recursive: true, force: true });
  }
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
    'router/student/formula files should not be touched'
  );

  const importedPaths = Object.keys(require.cache).map((filePath) => path.relative(projectRoot, filePath));
  const forbidden = importedPaths.filter((filePath) => {
    return filePath.startsWith('lib/router/')
      || filePath.startsWith('lib/formulas/')
      || filePath === 'lib/questionRouter.js'
      || filePath.startsWith('routes/student')
      || filePath === 'lib/server/questionAnswerService.js';
  });

  assert.deepEqual(forbidden, [], `teacher content routes should not import router/student/formula modules: ${forbidden.join(', ')}`);
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

function writeExtractionFixture(uploadId, extraction) {
  fs.mkdirSync(uploadExtractedDir, { recursive: true });
  fs.writeFileSync(
    path.join(uploadExtractedDir, `${uploadId}_extraction.json`),
    `${JSON.stringify(extraction, null, 2)}\n`
  );
}

function readKnowledgePack(rootDir, packId) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, packId, 'knowledge_pack.json'), 'utf8'));
}

function makeExtraction(overrides = {}) {
  const uploadId = overrides.uploadId || 'prepare-review-upload';
  const originalFileName = overrides.originalFileName || 'teacher_prepare_review_notes.txt';
  const text = overrides.text || 'Net force is the total force on an object. Balanced forces do not change motion. Net force is the sum of forces.';
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
      text: `Route synthetic page ${pageNumber}. selected-page-${pageNumber} means Selected page ${pageNumber} definition. ${'Selected import source sentence. '.repeat(Math.ceil(charactersPerPage / 34))}`.slice(0, charactersPerPage)
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

function makeAdaptiveLoopRouteExtraction(overrides = {}) {
  const uploadId = overrides.uploadId || 'adaptive-loop-analyze';
  const originalFileName = overrides.originalFileName || 'adaptive_loop_analyze.pdf';
  const sections = [
    {
      label: 'Page 1',
      sourceLocation: 'Page 1',
      pageNumber: 1,
      text: 'Vocabulary: adaptive one means a source-supported term.'
    },
    {
      label: 'Page 2',
      sourceLocation: 'Page 2',
      pageNumber: 2,
      text: 'Concept: adaptive two explains source-supported meaning.'
    },
    {
      label: 'Page 3',
      sourceLocation: 'Page 3',
      pageNumber: 3,
      text: ''
    },
    {
      label: 'Page 4',
      sourceLocation: 'Page 4',
      pageNumber: 4,
      text: 'tiny'
    },
    {
      label: 'Page 5',
      sourceLocation: 'Page 5',
      pageNumber: 5,
      text: 'Failure page ADAPTIVE_FAIL_CHUNK_TOKEN with enough text to queue and fail after retries.'
    },
    {
      label: 'Page 6',
      sourceLocation: 'Page 6',
      pageNumber: 6,
      text: 'A text-bearing page ADAPTIVE_NO_ITEMS_CHUNK_TOKEN that should return JSON without core generated items.'
    }
  ];
  const pages = sections.map((section) => ({
    pageNumber: section.pageNumber,
    text: section.text
  }));
  const text = sections.map((section) => section.text).join('\n\n');
  return {
    ...makeExtraction({
      uploadId,
      originalFileName,
      text,
      sections
    }),
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    pages,
    metadata: {
      detectedType: 'pdf',
      pageCount: 6,
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
    sourceTextSnippet: 'Net force is the total force on an object.'
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
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
  };
}

function makeSmokeTest(reviewStatus) {
  return {
    question: 'What do balanced forces do?',
    expectedAnswer: 'They do not change motion.',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
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
      || relativePath.startsWith('lib/formulas/')
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
