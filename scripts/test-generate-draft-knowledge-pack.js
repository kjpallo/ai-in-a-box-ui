const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');
const { validateKnowledgePack } = require('../lib/knowledge/validateKnowledgePack');
const { buildKnowledgePackPrompt } = require('../lib/uploads/buildKnowledgePackPrompt');
const {
  DEFAULT_OLLAMA_KEEP_ALIVE,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_BATCH_MAX_CHARACTERS,
  DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
  DEFAULT_PREVIEW_MAX_PAGES,
  DEFAULT_PREVIEW_MAX_CHARACTERS,
  buildImportEstimate,
  buildExtractionBatches,
  callOllamaGenerate,
  generateDraftKnowledgePack,
  identifyTextBearingPages,
  makeSelectedExtraction,
  resolveImportModel
} = require('../lib/uploads/generateDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-draft-pack-'));
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const extractionPath = path.join(tempRoot, 'example_extraction.json');
const standardsBankPath = path.join(tempRoot, 'standards_bank.json');
const rawModelResponsesDir = path.join(tempRoot, 'model-responses');
const approvedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const approvedPacksBefore = snapshotApprovedPacks();

main().catch((error) => {
  cleanupTempRoot();
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  fs.mkdirSync(draftPacksDir, { recursive: true });
  fs.writeFileSync(extractionPath, `${JSON.stringify(makeExtraction(), null, 2)}\n`);
  fs.writeFileSync(standardsBankPath, `${JSON.stringify(makeStandardsBank(), null, 2)}\n`);

  try {
    assertPromptIncludesControls();
    assertPromptSizeShrankForSmallChunk();
    assertPromptDoesNotRequireStandardsBank();
    await assertImportModelSelectionAndFallback();
    await assertImportModelOptionsUseLowMemoryEnv();
    await assertDefaultTimeoutAndKeepAliveReachModelClient();
    await assertCustomTimeoutAndKeepAliveReachModelClient();
    await assertOllamaRequestIncludesKeepAliveAndUsesTimeout();
    await assertModelCallsUseDeterministicOptions();
    await assertOllamaTimeoutReturnsUsefulError();
    await assertModelTimeoutClassifiedAsRuntimeFailure();
    await assertValidMockCreatesDraft();
    await assertMultiChunkUploadMergesBatchDrafts();
    await assertEmptyChunksStayTrackedInManifest();
    await assertDuplicateVocabularyAcrossChunksIsMergedWithEvidence();
    await assertSingularPluralVocabularyDuplicatesMergeWithAliases();
    await assertParentheticalAbbreviationsBecomeAliases();
    await assertVocabularyAndConceptCanSharePhrase();
    await assertFormulaLikeSourceCreatesReferenceFormula();
    await assertPptxFormulaLikeSourceCreatesReferenceFormula();
    await assertDamagedFormulaStaysPendingLowConfidence();
    await assertLargePdfSplitsIntoPageChunksAndBatches();
    await assertPreviewModeProcessesOnlyFirstPagesAndWritesNoDraft();
    await assertUltraSafePreviewUsesOneSmallChunk();
    await assertTextBearingPageMetadataAndEmptyPageFailure();
    await assertFullImportDefaultsToAllTextBearingPages();
    await assertPptxFullImportAndPreviewUseTextBearingSlides();
    await assertPreviewBatchFailureReturnsPartialPreview();
    await assertLaterBatchCrashWritesPartialDraft();
    await assertPreviewValidationFailureReturnsSalvagedPreview();
    await assertSelectedPageRangeProcessesOnlySelectedPages();
    await assertSelectedRangeCoverageKeepsQueuedChunks();
    await assertModelCallsStaySequential();
    await assertModelCrashRetriesWithSmallerChunks();
    await assertAdaptiveLoopProcessesAllChunksToTerminalStates();
    await assertRetryFailureReportsBatchCoverage();
    await assertCodeFencedJsonCreatesDraft();
    await assertExtraTextAroundJsonCreatesDraftWhenUnambiguous();
    await assertItemOnlyModelOutputGetsWrappedFromKnowledgeName();
    await assertCompactModelOutputNormalizesToValidDraftPacket();
    await assertMissingMetadataIsNormalizedAndValidates();
    await assertMissingTopLevelArraysAreNormalizedAndValidate();
    await assertTopLevelResultsArrayIsDroppedAndTrackedAsInvalid();
    await assertVocabularyReviewStatusIsNormalized();
    await assertFormulaSolverStatusIsNormalized();
    await assertConceptStructuralFieldsAreNormalized();
    await assertProblemBankStandardsMetadataIsNormalized();
    await assertConceptIdDerivedFromClaim();
    await assertConceptTitleDerivedFromSummary();
    await assertVocabularyTermAndIdAreNormalized();
    await assertMissingVocabularyDefinitionsRecoveredOrRemoved();
    await assertMissingConceptExplanationRecoveredOrRemoved();
    await assertSingleBadVocabularyItemDoesNotFailDraft();
    await assertVocabularyTermRecoveredFromTitleLabelOrName();
    await assertUnrecoverableVocabularyItemIsRemovedAndRecorded();
    await assertSectionLabelsRejectedAsVocabulary();
    await assertConceptAndFormulaSalvageBehavior();
    await assertAllInvalidGeneratedItemsFailGracefully();
    await assertSourceLessItemsAreMarkedNeedsReview();
    await assertModelApprovedStatusIsNormalizedToReviewable();
    await assertModelRejectedStatusIsNormalizedToReviewable();
    await assertHeadingOnlyVocabularyNeedsReview();
    await assertUnsupportedGeneratedDefinitionNeedsReview();
    await assertLowConfidenceGeneratedItemsNeedReview();
    await assertWordProblemOnlyEvidenceCannotApproveGenericVocabulary();
    await assertEnergyCoreConceptExtractionAndFormulaCapture();
    await assertEnergyFormulaDeterministicRecoveryFromSourceText();
    await assertSubjectNeutralKeyFormulaListSplitsIntoReferenceFormulas();
    await assertVocabularyTermColonDefinitionsAreTrimmed();
    await assertWholeSlideDefinitionsAreNotUsedWhenCleanTermLineExists();
    await assertMotionForcesDeterministicVocabularyFromSection();
    await assertAwkwardConceptTitlesAreCleanedToReadableTitles();
    await assertBiologyKrebsCycleNotesProduceConceptRecovery();
    await assertPlateTectonicsNotesProduceCauseEffectEvidenceConcepts();
    await assertHistoryPeopleEventsDatesProduceConcepts();
    await assertUsefulSectionLabelsAndFragmentsAreRejectedAsVocabularyTerms();
    await assertCodeExamplesAreRejectedAsReferenceFormulas();
    await assertMotionCoreConceptExtractionAndFormulaFiltering();
    await assertWorkedExampleFormulaIsRejected();
    await assertAlgebraWorkedExamplesDoNotBecomeReferenceFormulas();
    await assertUploadedFormulasRemainReferenceOnly();
    await assertDensityBuoyancyConceptExtractionAndVocabularyFiltering();
    await assertDensityBuoyancyRecoversSinkFloatAndDisplacementConcepts();
    await assertElectricityMagnetismFormulaRepairAndConceptWordingRecovery();
    assertPhysicalScienceProfilePromptRules();
    await assertPhysicalScienceProfilePromptAndCleanupRules();
    await assertFutureImportProfilesAreStoredWithoutCustomLogic();
    await assertLearningTargetConceptExplanationIsRecoveredFromNearbySourceText();
    await assertLearningTargetSentenceDoesNotBecomeUglyConceptTitle();
    await assertReviewItemsPreferOriginalUploadedFilename();
    await assertRequiredFactFieldsAreStillRejected();
    await assertInvalidMockJsonReturnsUsefulError();
    await assertRetryInvalidJsonCanRepairDraft();
    await assertInvalidStandardsAreRejected();
    assertEmptyStandardsMetadataValidates();
    assertRawInvalidPacketStillFailsValidator();
    assertApprovedPacksAreNotModified();
  } finally {
    cleanupTempRoot();
  }

  console.log('Draft knowledge pack generation tests passed.');
}

function assertEmptyStandardsMetadataValidates() {
  const standards = makeDefaultStandardsMetadata();
  const validation = validateKnowledgePack(makeGeneratedPack({
    vocabulary: [{ ...makeVocabularyItem(), standards }],
    concepts: [{ ...makeConceptItem(), standards }],
    referenceFormulas: [{ ...makeReferenceFormula(), standards }],
    problemBank: [{ ...makeProblemItem(), standards }],
    standardsMap: [],
    smokeTests: [{ ...makeGeneratedPack().smokeTests[0], standards }]
  }), { standardsBank: makeStandardsBank() });

  assert.equal(validation.valid, true, validation.errors.join('\n'));
}

async function assertItemOnlyModelOutputGetsWrappedFromKnowledgeName() {
  const itemOnlyPath = path.join(tempRoot, 'item_only_upload_extraction.json');
  fs.writeFileSync(itemOnlyPath, `${JSON.stringify({
    ...makeExtraction(),
    upload: {
      uploadId: 'upload-20260516-0037',
      originalFileName: 'Packet KEY Energy CP.pdf',
      storedFileName: 'upload-20260516-0037.pdf',
      extractionJsonFileName: 'upload-20260516-0037_extraction.json'
    },
    fileName: 'Packet KEY Energy CP.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    metadata: {
      detectedType: 'pdf',
      characterCount: makeExtraction().text.length,
      pageCount: 2
    }
  }, null, 2)}\n`);

  const itemOnlyDraft = {
    vocabulary: [makeVocabularyItem()],
    concepts: [makeConceptItem()],
    referenceFormulas: [makeReferenceFormula()],
    problemBank: [makeProblemItem()],
    standardsMap: [],
    smokeTests: [makeGeneratedPack().smokeTests[0]],
    metadata: {
      packId: 'model-should-not-own-wrapper',
      title: 'Model Should Not Own Wrapper'
    }
  };

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: itemOnlyPath,
    outputDraftDir: path.join(tempRoot, 'item-only-wrapped-drafts'),
    packName: 'Energy',
    modelClient: async () => JSON.stringify(itemOnlyDraft)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'draft-energy-upload-20260516-0037');
  assert.equal(result.title, 'Energy');
  assert.deepEqual(result.sourceFiles, ['Packet KEY Energy CP.pdf']);
  assert.ok(Array.isArray(result.timeline));
  assert.ok(result.timeline.some((event) => event.message === 'Building draft packet wrapper'));
  assert.ok(result.timeline.some((event) => event.message === 'Running validation'));

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.schemaVersion, '1.0.0');
  assert.equal(generated.packId, 'draft-energy-upload-20260516-0037');
  assert.equal(generated.title, 'Energy');
  assert.equal(generated.status, 'draft');
  assert.equal(generated.reviewStatus, 'pending');
  assert.equal(generated.sourceFiles[0].fileName, 'Packet KEY Energy CP.pdf');
  assert.equal(generated.sourceFiles[0].uploadId, 'upload-20260516-0037');
  assert.equal(generated.metadata.sourceUpload.originalFileName, 'Packet KEY Energy CP.pdf');
  assert.equal(generated.metadata.sourceUpload.uploadId, 'upload-20260516-0037');
  assert.equal(generated.metadata.packId, 'draft-energy-upload-20260516-0037');
}

async function assertCompactModelOutputNormalizesToValidDraftPacket() {
  const compactPath = path.join(tempRoot, 'compact_output_extraction.json');
  fs.writeFileSync(compactPath, `${JSON.stringify(makeExtraction({
    uploadId: 'upload-compact-0001',
    originalFileName: 'compact_source.txt'
  }), null, 2)}\n`);
  const compactModelOutput = {
    vocabulary: [{
      term: 'net force',
      studentDefinition: 'The total force after adding forces.',
      teacherDefinition: 'Vector sum of all forces.',
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'compact_source.txt',
      sourceLocation: 'Chunk 1',
      sourceTextSnippet: 'Net force is the sum of all forces acting on an object.'
    }],
    concepts: [{
      title: 'Balanced forces',
      studentExplanation: 'Balanced forces do not change motion.',
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'compact_source.txt',
      sourceLocation: 'Chunk 1',
      sourceTextSnippet: 'Balanced forces cancel each other.'
    }],
    referenceFormulas: [{
      title: 'Force formula',
      equation: 'F = m * a',
      solverStatus: 'reference_only',
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'compact_source.txt',
      sourceLocation: 'Chunk 1',
      sourceTextSnippet: 'F = m * a'
    }],
    uncertainSections: [{
      sourceLocation: 'Chunk 1',
      note: 'Check whether acceleration definition needs teacher wording.'
    }]
  };
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: compactPath,
    outputDraftDir: path.join(tempRoot, 'compact-output-drafts'),
    modelClient: async () => JSON.stringify(compactModelOutput)
  });
  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 1);
  assert.equal(generated.concepts.length, 1);
  assert.equal(generated.referenceFormulas.length, 1);
  assert.equal(generated.problemBank.length, 0);
  assert.deepEqual(generated.standardsMap, []);
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.deepEqual(generated.referenceFormulas[0].standards, makeDefaultStandardsMetadata());
  assert.ok(Array.isArray(generated.metadata.importUncertainSections));
  assert.ok(generated.metadata.importUncertainSections[0].note.includes('teacher wording'));
  const validation = validateKnowledgePack(generated);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
}

function assertRawInvalidPacketStillFailsValidator() {
  const validation = validateKnowledgePack({
    title: 'Raw Invalid Packet',
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
    metadata: {}
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('Missing required top-level field: packId'));

  const missingConceptFields = validateKnowledgePack({
    packId: 'raw-missing-concept-fields',
    title: 'Raw Missing Concept Fields',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [],
    concepts: [
      {
        aliases: [],
        keyIdeas: [],
        examples: [],
        nonExamples: [],
        commonMisconceptions: [],
        standards: [],
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'raw.txt',
        sourceLocation: 'p. 1',
        sourceTextSnippet: 'Raw concept text.'
      }
    ],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: [],
    metadata: {}
  });
  assert.equal(missingConceptFields.valid, false);
  assert.ok(missingConceptFields.errors.includes('concepts[0].conceptId must be a non-empty string.'));
  assert.ok(missingConceptFields.errors.includes('concepts[0].title must be a non-empty string.'));
}

function assertPromptIncludesControls() {
  const prompt = buildKnowledgePackPrompt({
    extraction: makeExtraction()
  });

  assert.ok(prompt.includes('Do not invent facts, standards, smoke tests, problem bank items, or metadata.'));
  assert.ok(prompt.includes('Standards are paused.'));
  assert.ok(prompt.includes('Use only the provided extracted text.'));
  assert.ok(prompt.includes('solverStatus: "reference_only"'));
  assert.ok(prompt.includes('Do not create or describe formula solver code.'));
  assert.ok(prompt.includes('Every vocabulary/concept/referenceFormula item must include: sourceFile, sourceLocation, sourceTextSnippet, confidence, reviewStatus.'));
  assert.ok(prompt.includes('Only include vocabulary terms explicitly present in the source text.'));
  assert.ok(prompt.includes('Extract only these sections: vocabulary, concepts, referenceFormulas, uncertainSections.'));
  assert.ok(prompt.includes('uncertainSections should be a short list of source areas'));
  assert.ok(prompt.includes('The same phrase may appear in both vocabulary and concepts when source evidence supports both roles.'));
  assert.ok(prompt.includes('People/events/dates/cause-effect content should become reviewable concepts'));
  assert.ok(prompt.includes('Do not output code snippets or programming examples as reference formulas.'));
  assert.ok(prompt.includes('Keep reviewStatus as "pending" for all generated items.'));
  assert.ok(prompt.includes('If uncertain, use confidence "low"'));
  assert.ok(prompt.includes('Return valid JSON only.'));
  assert.ok(prompt.includes('Return one JSON object only.'));
  assert.ok(prompt.includes('Do not use markdown or code fences.'));
  assert.ok(prompt.includes('Do not include comments or trailing commas.'));
  assert.ok(prompt.includes('"vocabulary": ['));
  assert.ok(prompt.includes('"concepts": ['));
  assert.ok(prompt.includes('"referenceFormulas": ['));
  assert.ok(prompt.includes('"uncertainSections": ['));
  assert.equal(prompt.includes('"problemBank": []'), false);
  assert.equal(prompt.includes('"standardsMap": []'), false);
  assert.equal(prompt.includes('"smokeTests": []'), false);
}

function assertPromptSizeShrankForSmallChunk() {
  const extraction = makeExtraction({
    text: 'Force equals mass times acceleration. F = m * a.',
    sections: [{
      label: 'Chunk 1',
      sourceLocation: 'Chunk 1',
      pageNumber: 1,
      chunkIndex: 1,
      text: 'Force equals mass times acceleration. F = m * a.'
    }]
  });
  const prompt = buildKnowledgePackPrompt({
    extraction
  });
  const bytes = Buffer.byteLength(prompt, 'utf8');
  assert.ok(bytes < 9000, `Expected compact prompt under 9000 bytes, got ${bytes}.`);
}

function assertPromptDoesNotRequireStandardsBank() {
  const promptWithout = buildKnowledgePackPrompt({
    extraction: makeExtraction()
  });
  const promptWith = buildKnowledgePackPrompt({
    extraction: makeExtraction(),
    standardsBank: makeStandardsBank()
  });

  assert.ok(promptWithout.includes('Standards are paused.'));
  assert.ok(promptWith.includes('Standards are paused.'));
  assert.equal(promptWith.includes('Available standards bank:'), false);
}

function assertPhysicalScienceProfilePromptRules() {
  const prompt = buildKnowledgePackPrompt({
    extraction: makeExtraction(),
    importProfile: 'physical_science'
  });
  assert.ok(prompt.includes('Physical science import profile is active.'));
  assert.ok(prompt.includes('Extract formulas only when an equation or clear symbolic relationship appears in the source text.'));
  assert.ok(prompt.includes('Do not output weak sentence-fragment concept titles.'));
}

async function assertPhysicalScienceProfilePromptAndCleanupRules() {
  const extraction = {
    ...makeExtraction(),
    metadata: {
      ...makeExtraction().metadata,
      importProfile: 'physical_science'
    },
    text: [
      'Thermal energy: energy transferred because of temperature difference.',
      'Wave speed = frequency x wavelengt',
      'Temperature is a measure of average kinetic energy.'
    ].join('\n'),
    sections: [{
      label: 'Page 2 / Chunk 1',
      sourceLocation: 'Page 2 / Chunk 1',
      pageNumber: 2,
      chunkIndex: 1,
      text: [
        'l Thermal energy: energy transferred because of temperature difference.',
        'Wave speed = frequency x wavelengt',
        'Temperature is a measure of average kinetic energy.'
      ].join('\n')
    }]
  };
  const extractionPathLocal = path.join(tempRoot, 'physical_science_cleanup_extraction.json');
  fs.writeFileSync(extractionPathLocal, `${JSON.stringify(extraction, null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPathLocal,
    outputDraftDir: path.join(tempRoot, 'physical-science-cleanup-drafts'),
    importProfile: 'physical_science',
    modelClient: async () => JSON.stringify({
      vocabulary: [
        {
          term: 'l Thermal energy',
          studentDefinition: '',
          teacherDefinition: '',
          sourceFile: 'science-notes.pdf',
          sourceLocation: 'Page 2 / Chunk 1',
          sourceTextSnippet: 'l Thermal energy: energy transferred because of temperature difference.',
          reviewStatus: 'pending',
          confidence: 'medium'
        }
      ],
      concepts: [
        {
          title: 'Physical Science Slide',
          studentExplanation: 'Temperature is a measure of average kinetic energy.',
          sourceFile: 'science-notes.pdf',
          sourceLocation: 'Page 2 / Chunk 1',
          sourceTextSnippet: 'Temperature is a measure of average kinetic energy.',
          reviewStatus: 'pending',
          confidence: 'medium'
        },
        {
          title: 'Cold Doe Flow',
          studentExplanation: 'Heat flows from warmer objects to colder objects.',
          sourceFile: 'science-notes.pdf',
          sourceLocation: 'Page 2 / Chunk 1',
          sourceTextSnippet: 'Heat flows from warmer objects to colder objects.',
          reviewStatus: 'pending',
          confidence: 'medium'
        },
        {
          title: 'Thermal Energy Transfer',
          studentExplanation: 'Thermal energy moves from warmer areas to cooler areas.',
          sourceFile: 'science-notes.pdf',
          sourceLocation: 'Page 2 / Chunk 1',
          sourceTextSnippet: 'Thermal energy moves from warmer areas to cooler areas.',
          reviewStatus: 'pending',
          confidence: 'medium'
        }
      ],
      referenceFormulas: [
        {
          title: 'Wave speed',
          equation: 'Wave speed = frequency x wavelengt',
          sourceFile: 'science-notes.pdf',
          sourceLocation: 'Page 2 / Chunk 1',
          sourceTextSnippet: 'Wave speed = frequency x wavelengt',
          reviewStatus: 'pending',
          confidence: 'medium'
        }
      ],
      uncertainSections: []
    })
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.metadata.importProfile, 'physical_science');
  assert.equal(generated.metadata.sourceUpload.importProfile, 'physical_science');
  assert.ok(generated.vocabulary.some((item) => item.term === 'Thermal energy'));
  assert.ok(generated.vocabulary.some((item) => item.studentDefinition && item.teacherDefinition));
  assert.equal(generated.concepts.some((item) => item.title === 'Physical Science Slide'), false);
  assert.equal(generated.concepts.some((item) => item.title === 'Cold Doe Flow'), false);
  assert.ok(generated.concepts.some((item) => /thermal|temperature/i.test(String(item.title || ''))));
  assert.ok(generated.referenceFormulas.some((item) => item.equation === 'v = f × λ'));
  assert.equal(generated.referenceFormulas.every((item) => item.solverStatus === 'reference_only'), true);
}

async function assertFutureImportProfilesAreStoredWithoutCustomLogic() {
  const extractionPathLocal = path.join(tempRoot, 'future_profile_extraction.json');
  fs.writeFileSync(extractionPathLocal, `${JSON.stringify(makeExtraction(), null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPathLocal,
    outputDraftDir: path.join(tempRoot, 'future-profile-drafts'),
    importProfile: 'chemistry',
    modelClient: async () => JSON.stringify(makeGeneratedPack())
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.metadata.importProfile, 'chemistry');
  assert.equal(generated.metadata.sourceUpload.importProfile, 'chemistry');
}

async function assertImportModelSelectionAndFallback() {
  const previousImportModel = process.env.OLLAMA_IMPORT_MODEL;
  const previousModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_MODEL = 'student-runtime-model';
  process.env.OLLAMA_IMPORT_MODEL = 'teacher-import-model';
  try {
    assert.equal(resolveImportModel({}), 'teacher-import-model');
    const calls = [];
    const withImportModel = await generateDraftKnowledgePack({
      extractionJsonPath: extractionPath,
      outputDraftDir: path.join(tempRoot, 'import-model-selection-drafts'),
      modelClient: async (request) => {
        calls.push(request);
        return JSON.stringify(makeGeneratedPack({ packId: 'generated-import-model-selection-draft' }));
      }
    });
    assert.equal(withImportModel.success, true, withImportModel.errors.join('\n'));
    assert.equal(calls[0].model, 'teacher-import-model');

    delete process.env.OLLAMA_IMPORT_MODEL;
    assert.equal(resolveImportModel({}), 'student-runtime-model');
    const fallbackCalls = [];
    const withFallbackModel = await generateDraftKnowledgePack({
      extractionJsonPath: extractionPath,
      outputDraftDir: path.join(tempRoot, 'import-model-fallback-drafts'),
      modelClient: async (request) => {
        fallbackCalls.push(request);
        return JSON.stringify(makeGeneratedPack({ packId: 'generated-import-model-fallback-draft' }));
      }
    });
    assert.equal(withFallbackModel.success, true, withFallbackModel.errors.join('\n'));
    assert.equal(fallbackCalls[0].model, 'student-runtime-model');

    assert.equal(resolveImportModel({ model: 'explicit-override' }), 'explicit-override');
  } finally {
    restoreEnvVar('OLLAMA_IMPORT_MODEL', previousImportModel);
    restoreEnvVar('OLLAMA_MODEL', previousModel);
  }
}

async function assertImportModelOptionsUseLowMemoryEnv() {
  const prevCtx = process.env.OLLAMA_IMPORT_NUM_CTX;
  const prevPredict = process.env.OLLAMA_IMPORT_NUM_PREDICT;
  process.env.OLLAMA_IMPORT_NUM_CTX = '512';
  process.env.OLLAMA_IMPORT_NUM_PREDICT = '128';
  try {
    const calls = [];
    const result = await generateDraftKnowledgePack({
      extractionJsonPath: extractionPath,
      outputDraftDir: path.join(tempRoot, 'import-low-memory-options-drafts'),
      modelClient: async (request) => {
        calls.push(request);
        return JSON.stringify(makeGeneratedPack({ packId: 'generated-import-low-memory-options-draft' }));
      }
    });
    assert.equal(result.success, true, result.errors.join('\n'));
    assert.equal(calls[0].options.num_ctx, 512);
    assert.equal(calls[0].options.num_predict, 128);
    assert.equal(result.inputSnapshot.modelSettings.num_ctx, 512);
    assert.equal(result.inputSnapshot.modelSettings.num_predict, 128);
  } finally {
    restoreEnvVar('OLLAMA_IMPORT_NUM_CTX', prevCtx);
    restoreEnvVar('OLLAMA_IMPORT_NUM_PREDICT', prevPredict);
  }
}

async function assertDefaultTimeoutAndKeepAliveReachModelClient() {
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'default-client-options-drafts'),
    modelClient: async (options) => {
      calls.push(options);
      return JSON.stringify(makeGeneratedPack({ packId: 'generated-default-client-options-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].timeoutMs, DEFAULT_OLLAMA_TIMEOUT_MS);
  assert.equal(calls[0].keepAlive, DEFAULT_OLLAMA_KEEP_ALIVE);
  assert.equal(calls[0].options.temperature, 0);
  assert.equal(calls[0].options.seed, 42);
}

async function assertCustomTimeoutAndKeepAliveReachModelClient() {
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'custom-client-options-drafts'),
    timeoutMs: 12345,
    keepAlive: '2m',
    retryInvalidJson: true,
    modelClient: async (options) => {
      calls.push(options);
      return calls.length === 1
        ? '{"packId":"broken",'
        : JSON.stringify(makeGeneratedPack({ packId: 'generated-custom-client-options-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.timeoutMs), [12345, 12345]);
  assert.deepEqual(calls.map((call) => call.keepAlive), ['2m', '2m']);
}

async function assertOllamaRequestIncludesKeepAliveAndUsesTimeout() {
  const requests = [];
  const restoreHttpRequest = mockHttpRequest((options, callback) => {
    const request = new EventEmitter();
    let body = '';
    request.write = (chunk) => {
      body += chunk;
    };
    request.end = () => {
      requests.push({
        timeout: options.timeout,
        body: JSON.parse(body)
      });

      const response = new EventEmitter();
      response.statusCode = 200;
      response.setEncoding = () => {};
      callback(response);
      response.emit('data', JSON.stringify({ response: JSON.stringify(makeGeneratedPack()) }));
      response.emit('end');
    };
    request.destroy = (error) => {
      request.emit('error', error);
    };
    return request;
  });

  try {
    const response = await callOllamaGenerate({
      model: 'gemma4:e2b',
      prompt: 'Build a draft',
      timeoutMs: 24680,
      keepAlive: '7m'
    });

    assert.equal(response, JSON.stringify(makeGeneratedPack()));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].timeout, 24680);
    assert.equal(requests[0].body.keep_alive, '7m');
    assert.equal(requests[0].body.stream, false);
    assert.equal(requests[0].body.format, 'json');
    assert.equal(requests[0].body.options.temperature, 0);
    assert.equal(requests[0].body.options.seed, 42);
  } finally {
    restoreHttpRequest();
  }
}

async function assertModelCallsUseDeterministicOptions() {
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'deterministic-options-drafts'),
    modelClient: async (options) => {
      calls.push(options);
      return JSON.stringify(makeGeneratedPack({ packId: 'generated-deterministic-options-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.deepEqual(calls[0].options, {
    temperature: 0,
    seed: 42,
    top_p: 1,
    top_k: 40
  });
  assert.equal(result.inputSnapshot.modelSettings.temperature, 0);
  assert.equal(result.inputSnapshot.promptVersion, 'teacher-content-draft-v3-compact');
  assert.ok(result.inputSnapshot.chunkTextHashes[0].hash);
}

async function assertOllamaTimeoutReturnsUsefulError() {
  const restoreHttpRequest = mockHttpRequest(() => {
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      request.emit('timeout');
    };
    request.destroy = (error) => {
      request.emit('error', error);
    };
    return request;
  });

  try {
    await assert.rejects(
      callOllamaGenerate({
        model: 'gemma4:e2b',
        prompt: 'Build a draft',
        timeoutMs: 10
      }),
      (error) => {
        assert.ok(error.message.includes('Ollama request timed out.'));
        assert.ok(error.message.includes('cold-loading'));
        assert.ok(error.message.includes('ollama run gemma4:e2b'));
        assert.ok(error.message.includes('--timeout-ms'));
        return true;
      }
    );
  } finally {
    restoreHttpRequest();
  }
}

async function assertModelTimeoutClassifiedAsRuntimeFailure() {
  const timeoutDraftDir = path.join(tempRoot, 'timeout-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: timeoutDraftDir,
    timeoutMs: 5,
    modelClient: async () => new Promise(() => {})
  });

  assert.equal(result.success, false);
  assert.equal(result.modelCrash, true);
  assert.equal(result.modelTimeout, true);
  assert.ok(result.errors.includes('Local Gemma took too long while reading this batch.'));
  assert.ok(result.failedBatches[0].errors.includes('Local Gemma took too long while reading this batch.'));
  assert.equal(fs.existsSync(timeoutDraftDir), false, 'Timed-out generation should not write a partial failed draft.');
}

async function assertValidMockCreatesDraft() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    standardsBankPath,
    outputDraftDir: draftPacksDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack())
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-force-draft');
  assert.equal(result.title, 'Generated Force Draft');
  assert.deepEqual(result.sourceFiles, ['teacher_force_notes.txt']);
  assert.equal(result.extractionCharacterCount, makeExtraction().text.length);
  assert.equal(result.extractionChunkCount, 1);
  assert.equal(result.validationPassed, true);
  assert.ok(result.outputPath.endsWith(path.join('generated-force-draft', 'knowledge_pack.json')));

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.ok(['pending', 'needs_review'].includes(generated.concepts[0].reviewStatus));
  assert.ok(['pending', 'needs_review'].includes(generated.problemBank[0].reviewStatus));
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.ok(['pending', 'needs_review'].includes(generated.referenceFormulas[0].reviewStatus));
  assert.deepEqual(generated.vocabulary[0].standards, makeDefaultStandardsMetadata());
  assert.deepEqual(generated.concepts[0].standards, makeDefaultStandardsMetadata());
  assert.deepEqual(generated.referenceFormulas[0].standards, makeDefaultStandardsMetadata());
  assert.deepEqual(generated.problemBank[0].standards, makeDefaultStandardsMetadata());
  assert.deepEqual(generated.standardsMap[0].standards, makeDefaultStandardsMetadata());
  assert.deepEqual(generated.smokeTests[0].standards, makeDefaultStandardsMetadata());
  assert.equal(result.coverageReport.totalChunks, 1);
  assert.equal(result.coverageReport.processedChunks, 1);
  assert.equal(result.coverageReport.chunksWithDraftItems, 1);
}

async function assertMultiChunkUploadMergesBatchDrafts() {
  const multiChunkPath = path.join(tempRoot, 'multi_chunk_extraction.json');
  fs.writeFileSync(multiChunkPath, `${JSON.stringify(makeMultiChunkExtraction(), null, 2)}\n`);

  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: multiChunkPath,
    outputDraftDir: path.join(tempRoot, 'multi-chunk-drafts'),
    maxBatchChunks: 1,
    modelClient: async ({ prompt }) => {
      calls.push(prompt);
      const index = calls.length;
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-multi-chunk-draft',
        vocabulary: [makeVocabularyItemForChunk(index)],
        concepts: [makeConceptItemForChunk(index)],
        referenceFormulas: [],
        problemBank: [makeProblemItemForChunk(index)],
        standardsMap: [],
        smokeTests: [
          {
            question: `What does topic ${index} say?`,
            expectedAnswer: `Topic ${index} answer from the source.`,
            reviewStatus: 'pending',
            confidence: 'low'
          }
        ]
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(calls.length, 3);
  assert.ok(calls[0].includes('batch 1 of 3'));
  assert.ok(calls[1].includes('Chunk 2'));
  assert.equal(result.coverageReport.totalChunks, 3);
  assert.equal(result.coverageReport.processedChunks, 3);
  assert.equal(result.coverageReport.chunksWithDraftItems, 3);
  assert.equal(result.coverageReport.itemCounts.vocabulary, 3);
  assert.equal(result.coverageReport.sourceManifest.length, 3);
  assert.deepEqual(result.coverageReport.sourceManifest.map((entry) => entry.chunkIndex), [1, 2, 3]);
  assert.equal(result.coverageReport.coverageSummary.draftedChunks, 3);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 3);
  assert.equal(generated.concepts.length, 3);
  assert.equal(generated.problemBank.length, 3);
  assert.equal(generated.metadata.importBatches, 3);
  assert.equal(generated.metadata.importCoverage.processedChunks, 3);
  assert.equal(generated.vocabulary[1].sourceLocation, 'Chunk 2');
  assert.equal(generated.problemBank[2].sourceTextSnippet, 'Chunk 3 includes a practice prompt.');
}

async function assertEmptyChunksStayTrackedInManifest() {
  const manifestPath = path.join(tempRoot, 'empty_chunk_manifest_extraction.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(makeExtractionWithEmptyChunk(), null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: manifestPath,
    outputDraftDir: path.join(tempRoot, 'empty-chunk-manifest-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-empty-chunk-manifest',
      vocabulary: [makeVocabularyItemForChunk(1)],
      concepts: [makeConceptItemForChunk(1)],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.coverageReport.totalChunks, 2);
  assert.equal(result.coverageReport.coverageSummary.skippedEmptyChunks, 1);
  assert.equal(result.coverageReport.coverageSummary.draftedChunks, 1);
  assert.equal(result.coverageReport.coverageSummary.queuedChunks, 0);
  assert.equal(result.coverageReport.sourceManifest.length, 2);
  assert.equal(result.coverageReport.sourceManifest[0].status, 'drafted');
  assert.equal(result.coverageReport.sourceManifest[1].status, 'skipped_empty');
}

async function assertDuplicateVocabularyAcrossChunksIsMergedWithEvidence() {
  const multiChunkPath = path.join(tempRoot, 'duplicate_vocab_extraction.json');
  fs.writeFileSync(multiChunkPath, `${JSON.stringify(makeMultiChunkExtraction(), null, 2)}\n`);

  let callCount = 0;
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: multiChunkPath,
    outputDraftDir: path.join(tempRoot, 'duplicate-vocab-drafts'),
    maxBatchChunks: 1,
    modelClient: async () => {
      callCount += 1;
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-duplicate-vocab-draft',
        vocabulary: [{
          ...makeVocabularyItemForChunk(callCount),
          term: callCount === 1 ? 'Net Force' : 'net-force',
          sourceLocation: `Chunk ${callCount}`,
          sourceTextSnippet: `Chunk ${callCount} says net force.`
        }],
        concepts: [],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 1);
  assert.equal(generated.metadata.deduplication.vocabulary.raw, 3);
  assert.equal(generated.metadata.deduplication.vocabulary.duplicatesRemoved, 2);
  assert.equal(generated.metadata.deduplication.vocabulary.final, 1);
  assert.ok(generated.vocabulary[0].sourceReferences.length >= 3);
  assert.ok(generated.vocabulary[0].sourceReferences.some((reference) => reference.sourceLocation === 'Chunk 2'));
}

async function assertSingularPluralVocabularyDuplicatesMergeWithAliases() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'singular-plural-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-singular-plural-vocab-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Joule',
          aliases: [],
          sourceLocation: 'Page 2',
          sourceTextSnippet: 'A Joule is a unit of energy.'
        },
        {
          ...makeVocabularyItem(),
          term: 'Joules',
          aliases: [],
          sourceLocation: 'Page 3',
          sourceTextSnippet: 'Energy is measured in Joules.'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 1);
  assert.equal(generated.vocabulary[0].term, 'Joule');
  assert.ok(generated.vocabulary[0].aliases.includes('Joules'));
  assert.equal(generated.metadata.deduplication.vocabulary.duplicatesRemoved, 1);
  assert.ok(generated.vocabulary[0].sourceReferences.some((reference) => reference.sourceLocation === 'Page 3'));
}

async function assertParentheticalAbbreviationsBecomeAliases() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'parenthetical-alias-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-parenthetical-alias-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Kinetic Energy (KE)',
          aliases: [],
          sourceTextSnippet: 'Kinetic Energy (KE) is energy of motion.'
        },
        {
          ...makeVocabularyItem(),
          term: 'joule',
          aliases: [],
          sourceTextSnippet: 'A joule (J) is a unit.'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const kineticEnergy = generated.vocabulary.find((item) => item.term === 'Kinetic Energy');
  const joule = generated.vocabulary.find((item) => item.term === 'joule');
  assert.ok(kineticEnergy);
  assert.ok(kineticEnergy.aliases.includes('KE'));
  assert.ok(joule);
  assert.ok(joule.aliases.includes('J'));
}

async function assertVocabularyAndConceptCanSharePhrase() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'shared-vocab-concept-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-shared-vocab-concept-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Kinetic Energy',
          sourceTextSnippet: 'Kinetic energy is energy of motion.'
        }
      ],
      concepts: [
        {
          ...makeConceptItem(),
          conceptId: 'kinetic-energy',
          title: 'Kinetic Energy',
          sourceTextSnippet: 'Kinetic energy depends on mass and speed.'
        }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 1);
  assert.equal(generated.concepts.length, 1);
  assert.equal(generated.vocabulary[0].term, 'Kinetic Energy');
  assert.equal(generated.concepts[0].title, 'Kinetic Energy');
}

async function assertFormulaLikeSourceCreatesReferenceFormula() {
  const formulaPath = path.join(tempRoot, 'formula_source_extraction.json');
  fs.writeFileSync(formulaPath, `${JSON.stringify(makeFormulaExtraction(), null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: formulaPath,
    outputDraftDir: path.join(tempRoot, 'formula-source-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-formula-source-draft',
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas.length, 1);
  assert.equal(generated.referenceFormulas[0].equation, 'v = d / t');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].sourceLocation, 'Page 1');
  assert.ok(generated.referenceFormulas[0].sourceTextSnippet.includes('v = d / t'));
  assert.ok(generated.referenceFormulas[0].variables.some((variable) => variable.symbol === 'v' && variable.meaning === 'speed'));
}

async function assertPptxFormulaLikeSourceCreatesReferenceFormula() {
  const formulaPath = path.join(tempRoot, 'pptx_formula_source_extraction.json');
  fs.writeFileSync(formulaPath, `${JSON.stringify(makePptxExtraction(), null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: formulaPath,
    outputDraftDir: path.join(tempRoot, 'pptx-formula-source-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-pptx-formula-source-draft',
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas.length, 1);
  assert.equal(generated.referenceFormulas[0].equation, 'v = d / t');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].sourceFile, 'teacher_energy_slides.pptx');
  assert.equal(generated.referenceFormulas[0].sourceLocation, 'Slide 2');
}

async function assertDamagedFormulaStaysPendingLowConfidence() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'damaged-formula-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-damaged-formula-draft',
      referenceFormulas: [
        {
          ...makeReferenceFormula(),
          equation: 'W = � / t',
          confidence: 'high',
          reviewStatus: 'approved'
        }
      ]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas[0].equation, 'W = � / t');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'needs_review');
  assert.equal(generated.referenceFormulas[0].confidence, 'low');
  assert.ok(generated.referenceFormulas[0].normalizationNotes.some((note) => note.includes('extraction-damaged')));
}

async function assertLargePdfSplitsIntoPageChunksAndBatches() {
  const extraction = makeLargePdfExtraction();
  const largePdfPath = path.join(tempRoot, 'large_pdf_extraction.json');
  fs.writeFileSync(largePdfPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const plan = buildExtractionBatches(extraction, {
    maxBatchCharacters: DEFAULT_BATCH_MAX_CHARACTERS,
    maxBatchChunks: 2
  });
  assert.ok(plan.chunks.length > 1, 'large PDF should not remain one giant Gemma chunk');
  assert.ok(plan.batches.length > 1, 'large PDF should become multiple Gemma batches');
  plan.batches.forEach((batch) => {
    assert.ok(String(batch.extraction.text || '').length <= DEFAULT_BATCH_MAX_CHARACTERS + 80, `batch too large: ${batch.extraction.text.length}`);
  });
  assert.equal(plan.chunks[0].pageNumber, 1);
  assert.equal(plan.chunks[0].sourceLocation, 'Page 1');
  assert.ok(plan.chunks[0].sourceSnippet.includes('Synthetic energy page 1'));

  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: largePdfPath,
    outputDraftDir: path.join(tempRoot, 'large-pdf-drafts'),
    maxBatchChunks: 2,
    modelClient: async ({ prompt }) => {
      calls.push(prompt);
      const pageMatch = prompt.match(/"label":\s*"Page (\d+)"/) || prompt.match(/Page (\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) : calls.length;
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-large-pdf-draft',
        vocabulary: [makeVocabularyItemForPage(page)],
        concepts: [makeConceptItemForPage(page)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(calls.length > 1);
  assert.equal(result.coverageReport.totalPages, 29);
  assert.equal(result.coverageReport.totalChunks, plan.chunks.length);
  assert.equal(result.coverageReport.processedChunks, plan.chunks.length);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.vocabulary.some((item) => item.sourceLocation.includes('Page 1')));
  assert.ok(generated.metadata.importCoverage.totalChunks > 1);
}

async function assertPreviewModeProcessesOnlyFirstPagesAndWritesNoDraft() {
  const previewPath = path.join(tempRoot, 'large_preview_extraction.json');
  fs.writeFileSync(previewPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 8, charactersPerPage: 900 }), null, 2)}\n`);
  const outputDraftDir = path.join(tempRoot, 'preview-drafts');
  const prompts = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: previewPath,
    outputDraftDir,
    previewOnly: true,
    modelClient: async ({ prompt }) => {
      prompts.push(prompt);
      return JSON.stringify(makeGeneratedPack({ packId: 'generated-preview-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.preview, true);
  assert.equal(result.previewReport.processedPageCount, DEFAULT_PREVIEW_MAX_PAGES);
  assert.equal(result.previewReport.importScope.scope, 'preview_sample');
  assert.equal(result.previewReport.importScope.sampleOnly, true);
  assert.equal(result.previewReport.importScope.rangeLabel, 'Pages 1-1');
  assert.ok(result.fullImportEstimate.characterCount > result.previewReport.processedCharacterCount);
  assert.equal(fs.existsSync(outputDraftDir), false, 'preview mode should not write a final draft pack.');
  assert.ok(prompts.some((prompt) => prompt.includes('Page 1')));
  assert.ok(prompts.every((prompt) => !prompt.includes('Page 4')));
}

async function assertUltraSafePreviewUsesOneSmallChunk() {
  const previewPath = path.join(tempRoot, 'ultra_safe_preview_extraction.json');
  fs.writeFileSync(previewPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 4, charactersPerPage: 1800 }), null, 2)}\n`);
  const outputDraftDir = path.join(tempRoot, 'ultra-safe-preview-drafts');
  const prompts = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: previewPath,
    outputDraftDir,
    previewOnly: true,
    previewMode: 'ultra-safe',
    previewMaxCharacters: 800,
    modelClient: async ({ prompt }) => {
      prompts.push(prompt);
      return JSON.stringify(makeGeneratedPack({ packId: 'generated-ultra-safe-preview-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.previewReport.processedPageCount, 1);
  assert.equal(result.previewReport.processedChunkCount, 1);
  assert.ok(result.previewReport.processedCharacterCount <= 800);
  assert.equal(prompts.length, 1, 'ultra-safe preview should make one Gemma call.');
  assert.equal(fs.existsSync(outputDraftDir), false, 'ultra-safe preview should not write a final draft pack.');
}

async function assertTextBearingPageMetadataAndEmptyPageFailure() {
  const extraction = makeLargePdfExtraction({ pages: 4, charactersPerPage: 700 });
  extraction.pages = extraction.pages.filter((page) => page.pageNumber !== 1);
  extraction.text = extraction.pages.map((page) => page.text).join('\n\n');
  extraction.metadata.characterCount = extraction.text.length;

  const textPageInfo = identifyTextBearingPages(extraction);
  assert.deepEqual(textPageInfo.pages, [2, 3, 4]);
  assert.equal(textPageInfo.firstTextPage, 2);

  const estimate = buildImportEstimate(extraction, {});
  assert.equal(estimate.firstTextPage, 2);
  assert.deepEqual(estimate.textBearingPages, [2, 3, 4]);

  const selected = makeSelectedExtraction(extraction, {
    importMode: 'selected',
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  });
  assert.equal(selected.success, false);
  assert.ok(selected.errors[0].includes('The selected page exists, but no extractable text was found there.'));
  assert.ok(selected.errors[0].includes('Try page 2, the first page with extracted text.'));

  const blankExtraction = {
    ...extraction,
    text: '',
    pages: [],
    sections: [],
    metadata: {
      ...extraction.metadata,
      characterCount: 0,
      pageCount: 4
    }
  };
  const blankSelected = makeSelectedExtraction(blankExtraction, {
    importMode: 'selected',
    importSelection: {
      pageStart: 1,
      pageEnd: 1
    }
  });
  assert.equal(blankSelected.success, false);
  assert.deepEqual(blankSelected.errors, ['No extractable text was found in this upload.']);
}

async function assertFullImportDefaultsToAllTextBearingPages() {
  const fullPath = path.join(tempRoot, 'full_text_bearing_extraction.json');
  const extraction = makeLargePdfExtraction({ pages: 5, charactersPerPage: 700 });
  extraction.pages[0].text = '';
  extraction.pages[4].text = '';
  extraction.text = extraction.pages.map((page) => page.text).join('\n\n');
  extraction.metadata.characterCount = extraction.text.length;
  fs.writeFileSync(fullPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const prompts = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: fullPath,
    outputDraftDir: path.join(tempRoot, 'full-text-bearing-drafts'),
    maxBatchChunks: 1,
    modelClient: async ({ prompt }) => {
      prompts.push(prompt);
      const pageMatch = prompt.match(/Synthetic energy page (\d+)/);
      const page = pageMatch ? Number(pageMatch[1]) : prompts.length + 1;
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-full-text-bearing-draft',
        vocabulary: [makeVocabularyItemForPage(page)],
        concepts: [makeConceptItemForPage(page)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.importSelection, null);
  assert.equal(result.importScope.scope, 'full_document');
  assert.equal(result.importScope.completePacketImported, true);
  assert.deepEqual(result.importScope.pages, [2, 3, 4]);
  assert.equal(result.importScope.rangeLabel, 'Pages 2-4');
  assert.ok(prompts.length >= 3, 'full import should loop through all text-bearing page chunks.');
  assert.ok(prompts.every((prompt) => !prompt.includes('Synthetic energy page 1')));
  assert.ok(prompts.every((prompt) => !prompt.includes('Synthetic energy page 5')));
  assert.ok(result.timeline.some((event) => event.type === 'batch_sent' && event.details.pageRange));
  assert.ok(result.timeline.some((event) => event.type === 'batch_received' && event.details.itemCounts));

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.metadata.importScope.scope, 'full_document');
  assert.equal(generated.metadata.importScope.rangeLabel, 'Pages 2-4');
  assert.equal(generated.metadata.importScope.completePacketImported, true);
}

async function assertPptxFullImportAndPreviewUseTextBearingSlides() {
  const pptxPath = path.join(tempRoot, 'pptx_text_bearing_extraction.json');
  const extraction = makePptxExtraction();
  fs.writeFileSync(pptxPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const estimate = buildImportEstimate(extraction, {});
  assert.equal(estimate.pageCount, 3);
  assert.deepEqual(estimate.textBearingPages, [2, 3]);
  assert.equal(estimate.firstTextPage, 2);

  const previewPrompts = [];
  const previewResult = await generateDraftKnowledgePack({
    extractionJsonPath: pptxPath,
    outputDraftDir: path.join(tempRoot, 'pptx-preview-drafts'),
    previewOnly: true,
    modelClient: async ({ prompt }) => {
      previewPrompts.push(prompt);
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-pptx-preview-draft',
        vocabulary: [],
        concepts: [],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(previewResult.success, true, previewResult.errors.join('\n'));
  assert.equal(previewPrompts.length, 1);
  assert.ok(previewPrompts[0].includes('Slide 2'));
  assert.ok(previewPrompts[0].includes('Formula: v = d / t'));
  assert.ok(!previewPrompts[0].includes('Slide 1'));
  assert.ok(!previewPrompts[0].includes('Slide 3'));
  assert.equal(previewResult.previewReport.importScope.rangeLabel, 'Pages 2-2');

  let activeCalls = 0;
  let maxActiveCalls = 0;
  const fullPrompts = [];
  const fullResult = await generateDraftKnowledgePack({
    extractionJsonPath: pptxPath,
    outputDraftDir: path.join(tempRoot, 'pptx-full-import-drafts'),
    maxBatchChunks: 1,
    modelClient: async ({ prompt }) => {
      activeCalls += 1;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      fullPrompts.push(prompt);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeCalls -= 1;
      const slideMatch = prompt.match(/Slide (\d+)/);
      const slide = slideMatch ? Number(slideMatch[1]) : fullPrompts.length;
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-pptx-full-import-draft',
        vocabulary: [{
          ...makeVocabularyItemForPage(slide),
          sourceFile: 'teacher_energy_slides.pptx',
          sourceLocation: `Slide ${slide}`,
          sourceTextSnippet: `Slide ${slide}`
        }],
        concepts: [],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(fullResult.success, true, fullResult.errors.join('\n'));
  assert.equal(maxActiveCalls, 1, 'PPTX Gemma batches must run one at a time.');
  assert.equal(fullPrompts.length, 2, 'full import should send all text-bearing slides.');
  assert.ok(fullPrompts[0].includes('Slide 2'));
  assert.ok(fullPrompts[1].includes('Slide 3'));
  assert.ok(fullPrompts.every((prompt) => !prompt.includes('Slide 1')));
  assert.deepEqual(fullResult.importScope.pages, [2, 3]);
  assert.equal(fullResult.importScope.completePacketImported, true);
  assert.equal(fullResult.importScope.rangeLabel, 'Pages 2-3');
}

async function assertPreviewBatchFailureReturnsPartialPreview() {
  const previewPath = path.join(tempRoot, 'partial_preview_extraction.json');
  fs.writeFileSync(previewPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 3, charactersPerPage: 900 }), null, 2)}\n`);
  const outputDraftDir = path.join(tempRoot, 'partial-preview-drafts');
  let calls = 0;
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: previewPath,
    outputDraftDir,
    previewOnly: true,
    previewMode: 'normal',
    previewMaxPages: 2,
    previewMaxCharacters: DEFAULT_PREVIEW_MAX_CHARACTERS,
    modelClient: async () => {
      calls += 1;
      if (calls > 1) {
        throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
      }
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-partial-preview-draft',
        vocabulary: [makeVocabularyItemForPage(1)],
        concepts: [makeConceptItemForPage(1)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.preview, true);
  assert.equal(result.partialPreview, true);
  assert.equal(result.validationPassed, false);
  assert.ok(result.previewReport.itemCounts ? true : result.previewReport.pack.vocabulary.length > 0);
  assert.ok(result.previewReport.failedBatches.length >= 1);
  assert.ok(result.timeline.some((event) => event.type === 'partial_preview_ready'));
  assert.equal(fs.existsSync(outputDraftDir), false, 'partial preview must not write a final draft pack.');
}

async function assertLaterBatchCrashWritesPartialDraft() {
  const partialPath = path.join(tempRoot, 'partial_full_import_extraction.json');
  fs.writeFileSync(partialPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 3, charactersPerPage: 700 }), null, 2)}\n`);
  const outputDraftDir = path.join(tempRoot, 'partial-full-import-drafts');
  let calls = 0;
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: partialPath,
    outputDraftDir,
    maxBatchCharacters: 750,
    maxBatchChunks: 1,
    retryMaxBatchCharacters: 350,
    modelClient: async () => {
      calls += 1;
      if (calls >= 3) {
        throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
      }
      return JSON.stringify(makeGeneratedPack({
        packId: `generated-partial-full-draft-${calls}`,
        vocabulary: [makeVocabularyItemForPage(calls)],
        concepts: [makeConceptItemForPage(calls)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.partialDraft, true);
  assert.equal(result.failedBatches.length, 1);
  assert.deepEqual(result.failedBatches[0].pages, [3]);
  assert.ok(result.timeline.some((event) => event.type === 'partial_draft_ready'));
  assert.ok(result.timeline.some((event) => event.type === 'draft_ready' && event.message === 'Partial draft ready for review'));
  assert.equal(result.importScope.completePacketImported, false);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.metadata.partialDraft, true);
  assert.equal(generated.metadata.partialImport.completePacketImported, false);
  assert.deepEqual(generated.metadata.partialImport.failedPages, [3]);
  assert.deepEqual(generated.metadata.importCoverage.failedBatches[0].pages, [3]);
  assert.deepEqual(generated.metadata.partialImport.processedPages, [1, 2]);
  assert.equal(generated.metadata.importCoverage.processedChunks, 3);
  assert.equal(generated.metadata.importCoverage.coverageSummary.failedChunks, 1);
  assert.ok(generated.vocabulary.some((item) => item.sourceLocation === 'Page 1'), 'successful earlier batch items should be kept.');
  assert.ok(!generated.vocabulary.some((item) => item.sourceLocation === 'Page 3'), 'failed page items must not be promoted into the partial draft.');
}

async function assertPreviewValidationFailureReturnsSalvagedPreview() {
  const previewPath = path.join(tempRoot, 'salvaged_validation_preview_extraction.json');
  fs.writeFileSync(previewPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 1, charactersPerPage: 900 }), null, 2)}\n`);
  const outputDraftDir = path.join(tempRoot, 'salvaged-validation-preview-drafts');
  const invalidPack = makeGeneratedPack({
    packId: 'generated-salvaged-validation-preview',
    concepts: [makeConceptItemForPage(1)],
    referenceFormulas: [
      {
        ...makeReferenceFormula(),
        equation: '',
        formula: '',
        expression: '',
        formulaText: '',
        sourceTextSnippet: '',
        sourceSnippet: ''
      }
    ],
    problemBank: [
      {
        ...makeProblemItem(),
        expectedAnswer: ''
      }
    ],
    standardsMap: [],
    smokeTests: []
  });
  const modelClient = async () => JSON.stringify(invalidPack);

  const previewResult = await generateDraftKnowledgePack({
    extractionJsonPath: previewPath,
    outputDraftDir,
    rawModelResponsesDir,
    previewOnly: true,
    previewMode: 'ultra-safe',
    previewMaxCharacters: 1000,
    modelClient
  });

  assert.equal(previewResult.success, true, previewResult.errors.join('\n'));
  assert.equal(previewResult.preview, true);
  assert.equal(previewResult.partialPreview, true);
  assert.equal(previewResult.validationPassed, false);
  assert.equal(previewResult.previewReport.partialPreview, true);
  assert.equal(previewResult.previewReport.validationPassed, false);
  assert.equal(previewResult.previewReport.pack.concepts.length, 1);
  assert.equal(previewResult.previewReport.pack.referenceFormulas.length, 0);
  assert.equal(previewResult.previewReport.pack.problemBank.length, 0);
  assert.ok(previewResult.invalidItems.length >= 1);
  assert.ok(previewResult.previewReport.invalidItems.some((entry) => entry.section === 'problemBank'));
  assert.ok(previewResult.previewReport.validationErrors.includes('problemBank[0].expectedAnswer must be a non-empty string.'));
  assert.ok(previewResult.timeline.some((event) => event.type === 'preview_validation_repair_needed'));
  assert.ok(previewResult.timeline.some((event) => event.type === 'preview_valid_items_kept'));
  assert.ok(previewResult.timeline.some((event) => event.type === 'preview_invalid_items_quarantined'));
  assert.ok(previewResult.timeline.some((event) => event.type === 'preview_final_draft_not_written'));
  assert.equal(fs.existsSync(outputDraftDir), false, 'preview salvage must not write a final draft pack.');

  const fullResult = await generateDraftKnowledgePack({
    extractionJsonPath: previewPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient
  });
  assert.equal(fullResult.success, false);
  assert.equal(fullResult.validationPassed, false);
  assert.ok(fullResult.errors.includes('problemBank[0].expectedAnswer must be a non-empty string.'));
  assert.equal(fs.existsSync(outputDraftDir), false, 'strict full import should not write the invalid draft pack.');
}

async function assertSelectedPageRangeProcessesOnlySelectedPages() {
  const selectedPath = path.join(tempRoot, 'selected_range_extraction.json');
  const extraction = makeLargePdfExtraction({ pages: 6, charactersPerPage: 700 });
  fs.writeFileSync(selectedPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const selected = makeSelectedExtraction(extraction, {
    importMode: 'selected',
    importSelection: {
      pageStart: 2,
      pageEnd: 4
    }
  });
  assert.equal(selected.success, true, selected.errors && selected.errors.join('\n'));
  assert.deepEqual(selected.importSelection.pages, [2, 3, 4]);
  assert.equal(selected.extraction.metadata.partialImport, true);

  const prompts = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: selectedPath,
    outputDraftDir: path.join(tempRoot, 'selected-range-drafts'),
    packName: 'Selected Range',
    importMode: 'selected',
    importSelection: {
      pageStart: 2,
      pageEnd: 4
    },
    modelClient: async ({ prompt }) => {
      prompts.push(prompt);
      assert.ok(!prompt.includes('Synthetic energy page 1'), 'selected import must not send page 1 to Gemma');
      assert.ok(!prompt.includes('Synthetic energy page 5'), 'selected import must not send page 5 to Gemma');
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-selected-range-draft',
        vocabulary: [makeVocabularyItemForPage(2)],
        concepts: [makeConceptItemForPage(2)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.deepEqual(result.importSelection.pages, [2, 3, 4]);
  assert.equal(result.importScope.scope, 'selected_range');
  assert.equal(result.importScope.rangeLimited, true);
  assert.equal(result.importSelection.completePacketImported, false);
  assert.ok(result.selectedImportEstimate.characterCount < result.fullImportEstimate.characterCount);
  assert.ok(result.timeline.some((event) => event.type === 'import_selection_ready'));
  assert.ok(prompts.length >= 1);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.metadata.partialImport.importedPages, [2, 3, 4]);
  assert.equal(generated.metadata.partialImport.completePacketImported, false);
  assert.equal(generated.metadata.partialImport.originalPageCount, 6);
  assert.equal(generated.metadata.importSelection.label, 'Pages 2-4');
  assert.equal(generated.metadata.importScope.scope, 'selected_range');
  assert.equal(generated.metadata.importScope.warning, 'This draft covers only Pages 2-4. It does not mark the whole packet imported.');
  assert.equal(generated.metadata.importCoverage.totalPages, 6);
  assert.equal(generated.metadata.importCoverage.coverageSummary.queuedChunks, 3);
  assert.equal(generated.metadata.importCoverage.coverageSummary.draftedChunks, 1);
  assert.equal(generated.vocabulary[0].sourceLocation, 'Page 2');
}

async function assertSelectedRangeCoverageKeepsQueuedChunks() {
  const selectedPath = path.join(tempRoot, 'selected_range_manifest_extraction.json');
  const extraction = makeLargePdfExtraction({ pages: 5, charactersPerPage: 650 });
  fs.writeFileSync(selectedPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: selectedPath,
    outputDraftDir: path.join(tempRoot, 'selected-range-manifest-drafts'),
    importMode: 'selected',
    importSelection: {
      pageStart: 2,
      pageEnd: 3
    },
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-selected-range-manifest',
      vocabulary: [makeVocabularyItemForPage(2)],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.coverageReport.coverageSummary.totalChunks, 5);
  assert.equal(result.coverageReport.coverageSummary.queuedChunks, 3);
  assert.ok(result.coverageReport.sourceManifest.some((entry) => entry.chunkIndex === 1 && entry.status === 'queued'));
  assert.ok(result.coverageReport.sourceManifest.some((entry) => entry.chunkIndex === 2 && entry.status === 'drafted'));
}

async function assertModelCallsStaySequential() {
  const sequentialPath = path.join(tempRoot, 'sequential_extraction.json');
  fs.writeFileSync(sequentialPath, `${JSON.stringify(makeLargePdfExtraction({ pages: 5, charactersPerPage: 900 }), null, 2)}\n`);
  let activeCalls = 0;
  let maxActiveCalls = 0;
  let calls = 0;
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: sequentialPath,
    outputDraftDir: path.join(tempRoot, 'sequential-drafts'),
    maxBatchCharacters: 1000,
    modelClient: async () => {
      activeCalls += 1;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeCalls -= 1;
      return JSON.stringify(makeGeneratedPack({ packId: `generated-sequential-draft-${calls}` }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(calls > 1, 'sequential test should exercise multiple batches.');
  assert.equal(maxActiveCalls, 1, 'Gemma model calls must run one batch at a time.');
}

async function assertModelCrashRetriesWithSmallerChunks() {
  const extraction = makeLargePdfExtraction({ pages: 2, charactersPerPage: 3200 });
  const crashPath = path.join(tempRoot, 'large_retry_extraction.json');
  fs.writeFileSync(crashPath, `${JSON.stringify(extraction, null, 2)}\n`);

  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: crashPath,
    outputDraftDir: path.join(tempRoot, 'retry-smaller-drafts'),
    maxBatchCharacters: 7000,
    retryMaxBatchCharacters: DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
    modelClient: async ({ prompt }) => {
      calls.push(prompt);
      if (calls.length === 1) {
        throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
      }
      assert.ok(prompt.length < calls[0].length, 'retry prompt should be smaller than the failed prompt');
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-retried-model-crash-draft',
        vocabulary: [makeVocabularyItemForPage(calls.length - 1)],
        concepts: [makeConceptItemForPage(calls.length - 1)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(calls.length > 1, 'model crash should retry with smaller chunks');
  assert.ok(result.timeline.some((event) => event.type === 'batch_retry'));
  assert.ok(result.timeline.some((event) => event.type === 'batch_retry_sent'));
  assert.ok(result.timeline.some((event) => event.type === 'batch_retry_recovered' && event.message === 'Recovered with smaller batch.'));
  assert.ok(result.warnings.includes('Recovered with smaller batch.'));
}

async function assertAdaptiveLoopProcessesAllChunksToTerminalStates() {
  const extractionPath = writeTempExtraction('adaptive_loop_extraction.json', makeAdaptiveLoopExtraction());
  const outputDraftDir = path.join(tempRoot, 'adaptive-loop-drafts');
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    adaptiveImportLoop: true,
    maxBatchChunks: 1,
    maxBatchCharacters: 350,
    retryMaxBatchCharacters: 180,
    modelClient: async ({ prompt }) => {
      const text = String(prompt || '');
      const page = text.includes('ADAPTIVE_PAGE_5_TOKEN') ? 5
        : text.includes('ADAPTIVE_PAGE_6_TOKEN') ? 6
        : text.includes('ADAPTIVE_PAGE_2_TOKEN') ? 2
        : 1;
      calls.push(page);
      if (page === 5) {
        throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
      }
      if (page === 6) {
        return JSON.stringify(makeGeneratedPack({
          packId: 'generated-adaptive-loop',
          vocabulary: [],
          concepts: [],
          referenceFormulas: [],
          problemBank: [],
          standardsMap: [],
          smokeTests: []
        }));
      }
      return JSON.stringify(makeGeneratedPack({
        packId: 'generated-adaptive-loop',
        vocabulary: [makeVocabularyItemForPage(page || 1)],
        concepts: [makeConceptItemForPage(page || 1)],
        referenceFormulas: [],
        problemBank: [],
        standardsMap: [],
        smokeTests: []
      }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(calls.includes(1));
  assert.ok(calls.includes(2));
  assert.ok(calls.includes(5));
  assert.ok(calls.includes(6));
  assert.ok(!calls.includes(3), 'empty chunk should stay skipped_empty and not run through Gemma.');
  assert.ok(!calls.includes(4), 'needs_review chunk should remain terminal and not run through Gemma.');
  assert.ok(result.timeline.some((event) => event.type === 'adaptive_progress_saved'));

  const manifest = result.coverageReport.sourceManifest;
  assert.equal(manifest.length, 6);
  assert.equal(manifest[0].status, 'drafted');
  assert.equal(manifest[1].status, 'drafted');
  assert.equal(manifest[2].status, 'skipped_empty');
  assert.equal(manifest[3].status, 'needs_review');
  assert.equal(manifest[4].status, 'failed_after_retries');
  assert.equal(manifest[5].status, 'no_items_found');
  assert.equal(result.coverageReport.coverageSummary.totalChunks, 6);
  assert.equal(result.coverageReport.coverageSummary.queuedChunks, 0);
  assert.equal(result.coverageReport.coverageSummary.allChunksTerminal, true);
  assert.equal(result.coverageReport.coverageSummary.failedChunks, 1);
  assert.equal(result.coverageReport.coverageSummary.noItemsFoundChunks, 1);
  assert.equal(result.coverageReport.coverageSummary.skippedEmptyChunks, 1);
  assert.equal(result.coverageReport.coverageSummary.needsReviewChunks, 1);
  assert.ok(result.coverageReport.failedBatches.length >= 1);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.vocabulary.some((item) => item.sourceLocation === 'Page 1'));
  assert.ok(generated.vocabulary.length >= 1, 'earlier successful chunk results should remain saved.');
  assert.ok(!generated.vocabulary.some((item) => item.sourceLocation === 'Page 5'));
  assert.equal(generated.metadata.importCoverage.coverageSummary.allChunksTerminal, true);
}

async function assertRetryFailureReportsBatchCoverage() {
  const extraction = makeLargePdfExtraction({ pages: 2, charactersPerPage: 3200 });
  const failurePath = path.join(tempRoot, 'large_retry_failure_extraction.json');
  fs.writeFileSync(failurePath, `${JSON.stringify(extraction, null, 2)}\n`);

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: failurePath,
    outputDraftDir: path.join(tempRoot, 'retry-failure-drafts'),
    maxBatchCharacters: 7000,
    retryMaxBatchCharacters: DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
    modelClient: async () => {
      throw new Error('Ollama returned HTTP 500: {"error":"model runner has unexpectedly stopped, this may be due to resource limitations"}');
    }
  });

  assert.equal(result.success, false);
  assert.equal(result.modelCrash, true);
  assert.ok(result.errors.some((error) => error.includes('Local Gemma crashed while reading batch 1')));
  assert.ok(result.errors.some((error) => error.includes('Retry failed after a smaller batch.')));
  assert.equal(
    result.errors.filter((error) => error.includes('Ollama returned HTTP 500')).length,
    1,
    'raw Ollama failure should appear once in the backend error list'
  );
  assert.ok(result.coverageReport.failedBatches.length >= 1);
  assert.ok(result.coverageReport.warnings.some((warning) => warning.includes('Model draft failed for batch 1')));
  assert.ok(result.timeline.some((event) => event.type === 'error' && event.message.includes('Local Gemma crashed while reading batch 1')));
}

async function assertCodeFencedJsonCreatesDraft() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'code-fenced-drafts'),
    modelClient: async () => `\`\`\`json\n${JSON.stringify(makeGeneratedPack({ packId: 'generated-fenced-draft' }))}\n\`\`\``
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-fenced-draft');
  assert.equal(result.validationPassed, true);
  assert.ok(fs.existsSync(result.outputPath));
}

async function assertExtraTextAroundJsonCreatesDraftWhenUnambiguous() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'extra-text-drafts'),
    modelClient: async () => [
      'Here is the draft JSON:',
      JSON.stringify(makeGeneratedPack({ packId: 'generated-extra-text-draft' })),
      'End.'
    ].join('\n')
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-extra-text-draft');
  assert.equal(result.validationPassed, true);
  assert.ok(fs.existsSync(result.outputPath));
}

async function assertInvalidMockJsonReturnsUsefulError() {
  const outputDraftDir = path.join(tempRoot, 'invalid-json-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => 'not json'
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('Model response was not valid JSON')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  assert.equal(fs.readFileSync(result.rawModelResponsePath, 'utf8'), 'not json');
  assert.equal(fs.existsSync(outputDraftDir), false);
}

async function assertMissingMetadataIsNormalizedAndValidates() {
  const generatedPack = makeGeneratedPack({ packId: 'generated-missing-metadata-draft' });
  delete generatedPack.metadata;

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'missing-metadata-drafts'),
    modelClient: async () => JSON.stringify(generatedPack)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.metadata.importCoverage.totalChunks, 1);
}

async function assertMissingTopLevelArraysAreNormalizedAndValidate() {
  const generatedPack = makeGeneratedPack({ packId: 'generated-missing-arrays-draft' });
  delete generatedPack.sourceFiles;
  delete generatedPack.vocabulary;
  delete generatedPack.concepts;
  delete generatedPack.referenceFormulas;
  delete generatedPack.problemBank;
  delete generatedPack.standardsMap;
  delete generatedPack.smokeTests;

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'missing-arrays-drafts'),
    modelClient: async () => JSON.stringify(generatedPack)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.sourceFiles.length, 1);
  assert.equal(generated.sourceFiles[0].fileName, 'teacher_force_notes.txt');
  assert.deepEqual(generated.vocabulary, []);
  assert.deepEqual(generated.concepts, []);
  assert.equal(generated.referenceFormulas.length, 1);
  assert.equal(generated.referenceFormulas[0].equation, 'F = m * a');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.deepEqual(generated.problemBank, []);
  assert.deepEqual(generated.standardsMap, []);
  assert.deepEqual(generated.smokeTests, []);
}

async function assertTopLevelResultsArrayIsDroppedAndTrackedAsInvalid() {
  const generatedPack = makeGeneratedPack({ packId: 'generated-results-top-level-draft' });
  generatedPack.results = [{ type: 'vocabulary', term: 'energy' }];

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'results-top-level-drafts'),
    modelClient: async () => JSON.stringify(generatedPack)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(Array.isArray(generated.results), false, 'Unsupported top-level results array should not be saved on the draft pack.');
  assert.ok(
    Array.isArray(generated.metadata.invalidGeneratedItems)
      && generated.metadata.invalidGeneratedItems.some((item) => item.section === 'results'),
    'Unsupported top-level results array should be tracked in invalidGeneratedItems.'
  );
}

async function assertVocabularyReviewStatusIsNormalized() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'vocab-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-vocab-normalized-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          standards: 'SAMPLE.PS.FORCES.1',
          reviewStatus: 'approved',
          confidence: 'certain'
        }
      ]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].reviewStatus, 'needs_review');
  assert.equal(generated.vocabulary[0].confidence, 'low');
  assert.deepEqual(generated.vocabulary[0].standards, makeDefaultStandardsMetadata());
}

async function assertFormulaSolverStatusIsNormalized() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'formula-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-formula-normalized-draft',
      referenceFormulas: [
        {
          ...makeReferenceFormula(),
          solverStatus: 'auto_solver',
          reviewStatus: 'approved',
          confidence: 'unknown'
        }
      ]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'needs_review');
  assert.equal(generated.referenceFormulas[0].confidence, 'low');
  assert.deepEqual(generated.referenceFormulas[0].standards, makeDefaultStandardsMetadata());
}

async function assertConceptStructuralFieldsAreNormalized() {
  const concept = makeConceptItem();
  delete concept.keyIdeas;
  delete concept.examples;
  delete concept.nonExamples;
  delete concept.commonMisconceptions;
  delete concept.sourceFile;
  delete concept.sourceLocation;
  delete concept.sourceTextSnippet;
  concept.standards = 'SAMPLE.PS.FORCES.1';
  concept.reviewStatus = 'approved';
  concept.confidence = 'certain';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'concept-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-concept-normalized-draft',
      concepts: [concept]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.concepts[0].keyIdeas, []);
  assert.deepEqual(generated.concepts[0].examples, []);
  assert.deepEqual(generated.concepts[0].nonExamples, []);
  assert.deepEqual(generated.concepts[0].commonMisconceptions, []);
  assert.deepEqual(generated.concepts[0].standards, makeDefaultStandardsMetadata());
  assert.equal(generated.concepts[0].reviewStatus, 'needs_review');
  assert.equal(generated.concepts[0].confidence, 'low');
  assert.equal(generated.concepts[0].sourceFile, 'teacher_force_notes.txt');
  assert.equal(generated.concepts[0].sourceLocation, 'extracted text');
  assert.ok(generated.concepts[0].sourceTextSnippet.includes('Force is a push or pull.'));
}

async function assertProblemBankStandardsMetadataIsNormalized() {
  const problem = makeProblemItem();
  delete problem.standards;

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'problem-standards-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-problem-standards-normalized-draft',
      problemBank: [problem]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.problemBank[0].standards, makeDefaultStandardsMetadata());
}

async function assertConceptIdDerivedFromClaim() {
  const concept = makeConceptItem();
  delete concept.conceptId;
  concept.title = '';
  concept.claim = 'Net force changes motion';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'concept-id-derived-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-concept-id-derived-draft',
      concepts: [concept]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.concepts[0].conceptId, 'concept-net-force-changes-motion');
  assert.equal(generated.concepts[0].title, 'Motion And Forces');
  assert.ok(generated.concepts[0].normalizationNotes.some((note) => note.includes('concept ID')));
  assert.ok(generated.metadata.importNormalization.conceptIdsGenerated >= 1);

  const repeatResult = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'concept-id-derived-repeat-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-concept-id-derived-repeat-draft',
      concepts: [concept]
    }))
  });
  assert.equal(repeatResult.success, true, repeatResult.errors.join('\n'));
  const repeated = JSON.parse(fs.readFileSync(repeatResult.outputPath, 'utf8'));
  assert.equal(repeated.concepts[0].conceptId, generated.concepts[0].conceptId);
}

async function assertConceptTitleDerivedFromSummary() {
  const concept = makeConceptItem();
  concept.conceptId = '';
  concept.title = '';
  concept.claim = '';
  concept.summary = 'Balanced forces do not change an object motion.';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'concept-title-derived-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-concept-title-derived-draft',
      concepts: [concept]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.concepts[0].title, 'Balanced Forces');
  assert.equal(generated.concepts[0].conceptId, 'concept-balanced-forces-do-not-change-an-object-motion');
  assert.ok(generated.concepts[0].normalizationNotes.some((note) => note.includes('concept title')));
  assert.ok(generated.metadata.importNormalization.conceptTitlesGenerated >= 1);
}

async function assertVocabularyTermAndIdAreNormalized() {
  const vocabulary = makeVocabularyItem();
  delete vocabulary.term;
  vocabulary.synonym = 'force';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'vocab-term-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-vocab-term-normalized-draft',
      vocabulary: [vocabulary]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].term, 'force');
  assert.equal(generated.vocabulary[0].vocabId, 'vocab-force');
  assert.ok(generated.metadata.importNormalization.vocabularyTermsGenerated >= 1);
  assert.ok(generated.metadata.importNormalization.vocabularyIdsGenerated >= 1);
}

async function assertMissingVocabularyDefinitionsRecoveredOrRemoved() {
  const missingDefinitionPath = writeTempExtraction('missing_vocab_definition_extraction.json', {
    ...makeExtraction(),
    text: 'Velocity is speed with direction. Friction is a force that opposes motion.',
    sections: [{
      label: 'Page 1',
      sourceLocation: 'Page 1',
      text: 'Velocity is speed with direction. Friction is a force that opposes motion.'
    }],
    metadata: { detectedType: 'txt', characterCount: 74, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: missingDefinitionPath,
    outputDraftDir: path.join(tempRoot, 'missing-vocab-definition-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Velocity',
          studentDefinition: '',
          teacherDefinition: ''
        },
        {
          ...makeVocabularyItem(),
          term: 'Core Concept',
          studentDefinition: '',
          teacherDefinition: ''
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const velocity = generated.vocabulary.find((item) => normalizeLoose(item.term) === 'velocity');
  assert.ok(velocity, 'Velocity should remain after wording recovery.');
  assert.notEqual(normalizeLoose(velocity.studentDefinition), '', 'Recovered studentDefinition should not be empty.');
  assert.notEqual(normalizeLoose(velocity.teacherDefinition), '', 'Recovered teacherDefinition should not be empty.');
  assert.equal(generated.vocabulary.some((item) => normalizeLoose(item.term) === 'core concept'), false, 'Section label vocabulary should be removed.');
  assert.equal(generated.vocabulary.some((item) => /missing/i.test(String(item.studentDefinition || ''))), false);
}

async function assertMissingConceptExplanationRecoveredOrRemoved() {
  const missingExplanationPath = writeTempExtraction('missing_concept_explanation_extraction.json', {
    ...makeExtraction(),
    text: [
      'Core Concept: Energy is not used up; it is transferred or transformed.',
      'An object higher above the ground has more gravitational potential energy.'
    ].join(' '),
    sections: [{
      label: 'Page 2',
      sourceLocation: 'Page 2',
      text: [
        'Core Concept: Energy is not used up; it is transferred or transformed.',
        'An object higher above the ground has more gravitational potential energy.'
      ].join(' ')
    }],
    metadata: { detectedType: 'txt', characterCount: 147, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: missingExplanationPath,
    outputDraftDir: path.join(tempRoot, 'missing-concept-explanation-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      concepts: [
        {
          ...makeConceptItem(),
          title: 'Energy is not used up; it is transferred or transformed.',
          studentExplanation: ''
        },
        {
          ...makeConceptItem(),
          title: 'Unknown concept placeholder',
          studentExplanation: ''
        }
      ],
      vocabulary: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.concepts.some((item) => item.title === 'Energy Transfer and Transformation'));
  assert.equal(generated.concepts.some((item) => /draft wording not available/i.test(String(item.studentExplanation || ''))), false);
}

async function assertSingleBadVocabularyItemDoesNotFailDraft() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'salvage-single-bad-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-single-bad-vocab',
      vocabulary: [
        makeVocabularyItem(),
        {
          ...makeVocabularyItem(),
          term: '',
          title: '',
          label: '',
          name: '',
          word: '',
          synonym: '',
          synonyms: [],
          alias: '',
          aliases: [],
          sourceTextSnippet: ''
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors && result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 1, 'unrecoverable vocabulary rows should be dropped, not block the draft.');
  assert.equal(generated.vocabulary[0].term, 'force');
  assert.ok(Array.isArray(generated.metadata.invalidGeneratedItems));
  assert.ok(generated.metadata.invalidGeneratedItems.some((entry) => entry.section === 'vocabulary'));
  const validation = validateKnowledgePack(generated, { standardsPaused: true });
  assert.equal(validation.valid, true, validation.errors.join('\n'));
}

async function assertVocabularyTermRecoveredFromTitleLabelOrName() {
  const outputDraftDir = path.join(tempRoot, 'salvage-vocab-recovery-drafts');
  const viaTitle = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(outputDraftDir, 'title'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-vocab-title',
      vocabulary: [{
        ...makeVocabularyItem(),
        term: '',
        word: '',
        synonym: '',
        synonyms: [],
        alias: '',
        aliases: [],
        title: 'Net Force',
        label: '',
        name: '',
        sourceTextSnippet: ''
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });
  assert.equal(viaTitle.success, true, viaTitle.errors && viaTitle.errors.join('\n'));
  const titlePack = JSON.parse(fs.readFileSync(viaTitle.outputPath, 'utf8'));
  assert.equal(titlePack.vocabulary[0].term, 'Net Force');

  const viaLabel = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(outputDraftDir, 'label'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-vocab-label',
      vocabulary: [{
        ...makeVocabularyItem(),
        term: '',
        word: '',
        synonym: '',
        synonyms: [],
        alias: '',
        aliases: [],
        title: '',
        label: 'Balanced Force',
        name: '',
        sourceTextSnippet: ''
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });
  assert.equal(viaLabel.success, true, viaLabel.errors && viaLabel.errors.join('\n'));
  const labelPack = JSON.parse(fs.readFileSync(viaLabel.outputPath, 'utf8'));
  assert.equal(labelPack.vocabulary[0].term, 'Balanced Force');

  const viaName = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(outputDraftDir, 'name'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-vocab-name',
      vocabulary: [{
        ...makeVocabularyItem(),
        term: '',
        word: '',
        synonym: '',
        synonyms: [],
        alias: '',
        aliases: [],
        title: '',
        label: '',
        name: 'Inertia',
        sourceTextSnippet: ''
      }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });
  assert.equal(viaName.success, true, viaName.errors && viaName.errors.join('\n'));
  const namePack = JSON.parse(fs.readFileSync(viaName.outputPath, 'utf8'));
  assert.equal(namePack.vocabulary[0].term, 'Inertia');
}

async function assertUnrecoverableVocabularyItemIsRemovedAndRecorded() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'salvage-unrecoverable-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-unrecoverable-vocab',
      vocabulary: [{
        ...makeVocabularyItem(),
        term: '',
        title: '',
        label: '',
        name: '',
        word: '',
        synonym: '',
        synonyms: [],
        alias: '',
        aliases: [],
        sourceTextSnippet: ''
      }],
      concepts: [makeConceptItem()],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors && result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 0);
  assert.ok(Array.isArray(generated.metadata.invalidGeneratedItems));
  assert.ok(generated.metadata.invalidGeneratedItems.some((entry) => entry.section === 'vocabulary'));
  assert.ok(Array.isArray(generated.metadata.importWarnings));
  assert.ok(generated.metadata.importWarnings.some((warning) => warning.includes('Removed invalid generated item vocabulary')));
}

async function assertSectionLabelsRejectedAsVocabulary() {
  const labelsPath = writeTempExtraction('section_labels_as_vocab_extraction.json', {
    ...makeExtraction(),
    text: 'Core Concept: Motion changes when forces are unbalanced.',
    sections: [{
      label: 'Slide 3',
      sourceLocation: 'Slide 3',
      text: 'Core Concept: Motion changes when forces are unbalanced.'
    }],
    metadata: { detectedType: 'pptx', characterCount: 55, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: labelsPath,
    outputDraftDir: path.join(tempRoot, 'section-label-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'Core Concept' },
        { ...makeVocabularyItem(), term: 'Concept Check' },
        { ...makeVocabularyItem(), term: 'force' }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const terms = new Set(generated.vocabulary.map((item) => normalizeLoose(item.term)));
  assert.equal(terms.has('core concept'), false);
  assert.equal(terms.has('concept check'), false);
  assert.equal(terms.has('force'), true);
}

async function assertConceptAndFormulaSalvageBehavior() {
  const salvagePath = writeTempExtraction('salvage_concept_formula_extraction.json', {
    ...makeExtraction(),
    text: 'Balanced forces affect motion. No symbolic equations are present in this source sample.',
    sections: [
      {
        label: 'Page 1',
        sourceLocation: 'Page 1',
        text: 'Balanced forces affect motion. No symbolic equations are present in this source sample.'
      }
    ],
    metadata: {
      detectedType: 'txt',
      characterCount: 83,
      pageCount: 1
    }
  });
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: salvagePath,
    outputDraftDir: path.join(tempRoot, 'salvage-concepts-formulas-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-concepts-formulas',
      vocabulary: [makeVocabularyItem()],
      concepts: [
        {
          ...makeConceptItem(),
          title: '',
          conceptId: 'net-force-concept-id',
          studentExplanation: ''
        },
        {
          ...makeConceptItem(),
          title: '',
          conceptId: '',
          concept: '',
          claim: '',
          summary: '',
          explanation: '',
          studentExplanation: '',
          sourceTextSnippet: ''
        }
      ],
      referenceFormulas: [
        {
          ...makeReferenceFormula(),
          title: '',
          equation: 'F = m * a'
        },
        {
          ...makeReferenceFormula(),
          title: '',
          equation: '',
          formula: '',
          expression: '',
          formulaText: '',
          sourceTextSnippet: ''
        }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors && result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.concepts.length >= 1);
  assert.equal(generated.concepts[0].title, 'Net Force Concept Id');
  assert.equal(generated.referenceFormulas.length, 1);
  assert.equal(generated.referenceFormulas[0].title, 'Net Force Formula');
  assert.equal(generated.referenceFormulas[0].equation, 'F = m * a');
  assert.equal(generated.concepts.some((item) => /draft wording not available/i.test(String(item.studentExplanation || ''))), false);
  assert.ok(generated.metadata.invalidGeneratedItems.some((entry) => entry.section === 'referenceFormulas'));
}

async function assertAllInvalidGeneratedItemsFailGracefully() {
  const allInvalidPath = writeTempExtraction('all_invalid_salvage_extraction.json', {
    ...makeExtraction(),
    text: 'N/A',
    sections: [
      {
        label: 'Page 1',
        sourceLocation: 'Page 1',
        text: 'N/A'
      }
    ],
    metadata: {
      detectedType: 'txt',
      characterCount: 3,
      pageCount: 1
    }
  });
  const outputDraftDir = path.join(tempRoot, 'salvage-all-invalid-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: allInvalidPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-salvage-all-invalid',
      vocabulary: [{
        ...makeVocabularyItem(),
        term: '',
        title: '',
        label: '',
        name: '',
        word: '',
        synonym: '',
        synonyms: [],
        alias: '',
        aliases: [],
        sourceTextSnippet: ''
      }],
      concepts: [{
        ...makeConceptItem(),
        title: '',
        conceptId: '',
        concept: '',
        claim: '',
        summary: '',
        explanation: '',
        studentExplanation: '',
        sourceTextSnippet: ''
      }],
      referenceFormulas: [{
        ...makeReferenceFormula(),
        title: '',
        equation: '',
        formula: '',
        expression: '',
        formulaText: '',
        sourceTextSnippet: ''
      }],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.equal(result.errors[0], 'No usable draft items were created from this upload.');
  assert.ok(result.errors.some((error) => error.includes('Removed vocabulary[0] during draft salvage')));
  assert.ok(Array.isArray(result.invalidItems));
  assert.equal(result.invalidItems.length, 3);
  assert.ok(result.rawModelResponsePath);
  assert.equal(fs.existsSync(outputDraftDir), false, 'all-invalid output must not write a final draft packet.');
}

async function assertSourceLessItemsAreMarkedNeedsReview() {
  const concept = makeConceptItem();
  delete concept.sourceFile;
  delete concept.sourceLocation;
  delete concept.sourceTextSnippet;
  concept.confidence = 'high';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'sourceless-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-sourceless-normalized-draft',
      concepts: [concept]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.concepts[0].reviewStatus, 'needs_review');
  assert.equal(generated.concepts[0].confidence, 'low');
  assert.equal(generated.concepts[0].sourceFile, 'teacher_force_notes.txt');
  assert.ok(generated.concepts[0].normalizationNotes.some((note) => note.includes('Source evidence was filled')));
  assert.ok(generated.metadata.importNormalization.sourceEvidenceFilled >= 1);
  assert.ok(generated.metadata.importNormalization.reviewNeededItems >= 1);
}

async function assertModelApprovedStatusIsNormalizedToReviewable() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'model-approved-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          reviewStatus: 'approved',
          confidence: 'high'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.notEqual(generated.vocabulary[0].reviewStatus, 'approved');
}

async function assertModelRejectedStatusIsNormalizedToReviewable() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'model-rejected-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          reviewStatus: 'rejected',
          confidence: 'medium'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.notEqual(generated.vocabulary[0].reviewStatus, 'rejected');
}

async function assertHeadingOnlyVocabularyNeedsReview() {
  const headingOnlyPath = writeTempExtraction('heading_only_energy_extraction.json', {
    ...makeExtraction(),
    text: 'Energy',
    sections: [{ label: 'Page 1', sourceLocation: 'Page 1', text: 'Energy' }],
    metadata: { detectedType: 'txt', characterCount: 6, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: headingOnlyPath,
    outputDraftDir: path.join(tempRoot, 'heading-only-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Energy',
          studentDefinition: 'Energy is the ability to do work.',
          teacherDefinition: 'Energy is the capacity to cause change.',
          sourceLocation: 'Page 1',
          sourceTextSnippet: 'Energy'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].reviewStatus, 'needs_review');
  assert.equal(generated.vocabulary[0].confidence, 'low');
  assert.equal(generated.vocabulary[0].repairStatus, 'repair_needed');
  assert.equal(generated.vocabulary[0].sourceGrounding.status, 'unsupported');
  assert.ok(generated.vocabulary[0].warnings.includes('Generated wording was not strongly supported by the extracted source text.'));
  assert.ok(generated.vocabulary[0].warnings.includes('Only limited text was extracted from this range. Review may need OCR later.'));
}

async function assertUnsupportedGeneratedDefinitionNeedsReview() {
  const unsupportedPath = writeTempExtraction('unsupported_potential_energy_extraction.json', makeWordProblemOnlyExtraction());

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: unsupportedPath,
    outputDraftDir: path.join(tempRoot, 'unsupported-definition-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [makePotentialEnergyVocabularyItem()],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].term, 'Potential Energy');
  assert.notEqual(generated.vocabulary[0].reviewStatus, 'approved');
  assert.ok(['pending', 'needs_review'].includes(generated.vocabulary[0].reviewStatus));
  assert.equal(generated.vocabulary[0].repairStatus, 'repair_needed');
  assert.ok(['weak', 'unsupported'].includes(generated.vocabulary[0].sourceGrounding.status));
  assert.ok(generated.vocabulary[0].warnings.includes('Generated wording was not strongly supported by the extracted source text.'));
}

async function assertLowConfidenceGeneratedItemsNeedReview() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'low-confidence-source-grounded-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          reviewStatus: 'approved',
          confidence: 'low'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].reviewStatus, 'needs_review');
  assert.equal(generated.vocabulary[0].confidence, 'low');
  assert.equal(generated.vocabulary[0].sourceGrounding.status, 'supported');
}

async function assertWordProblemOnlyEvidenceCannotApproveGenericVocabulary() {
  const wordProblemPath = writeTempExtraction('word_problem_only_energy_extraction.json', makeWordProblemOnlyExtraction());

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: wordProblemPath,
    outputDraftDir: path.join(tempRoot, 'word-problem-only-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makePotentialEnergyVocabularyItem(),
          reviewStatus: 'approved',
          confidence: 'high'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.notEqual(generated.vocabulary[0].reviewStatus, 'approved');
  assert.equal(generated.vocabulary[0].repairStatus, 'repair_needed');
  assert.ok(['weak', 'unsupported'].includes(generated.vocabulary[0].sourceGrounding.status));
}

async function assertEnergyCoreConceptExtractionAndFormulaCapture() {
  const extraction = writeTempExtraction('energy_core_concept_extraction.json', {
    ...makeExtraction(),
    fileName: 'energy_packet.pptx',
    text: [
      'Vocabulary: Energy, Work, Kinetic energy, Potential energy, Power, Watt, Joule',
      'Core Concept: Energy changes form but is conserved.',
      'Energy can transfer by work, heat, and waves.',
      'Formula: W = F × d',
      'Formula: KE = 1/2 m v²',
      'Formula: PE = m g h',
      'Formula: P = W/t'
    ].join('\n'),
    sections: [{
      label: 'Slide 1',
      sourceLocation: 'Slide 1',
      pageNumber: 1,
      text: [
        'Vocabulary: Energy, Work, Kinetic energy, Potential energy, Power, Watt, Joule',
        'Core Concept: Energy changes form but is conserved.',
        'Energy can transfer by work, heat, and waves.',
        'Formula: W = F × d',
        'Formula: KE = 1/2 m v²',
        'Formula: PE = m g h',
        'Formula: P = W/t'
      ].join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: 330, pageCount: 6 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'energy-core-concept-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'Energy' },
        { ...makeVocabularyItem(), term: 'More mass' },
        { ...makeVocabularyItem(), term: 'More speed' },
        { ...makeVocabularyItem(), term: 'Kinetic energy' }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const vocabTerms = generated.vocabulary.map((item) => item.term.toLowerCase());
  assert.equal(vocabTerms.includes('more mass'), false);
  assert.equal(vocabTerms.includes('more speed'), false);
  assert.ok(vocabTerms.includes('energy'));
  assert.ok(generated.concepts.length > 0, 'Core Concept text should produce at least one concept.');
  assert.ok(generated.concepts.some((item) => String(item.studentExplanation || '').trim().length > 0));
  const equations = new Set(generated.referenceFormulas.map((item) => canonicalEquation(item.equation)));
  assert.ok(equations.has('w=f*d'));
  assert.ok(equations.has('pe=mgh'));
}

async function assertEnergyFormulaDeterministicRecoveryFromSourceText() {
  const extraction = writeTempExtraction('energy_formula_deterministic_recovery.json', {
    ...makeExtraction(),
    fileName: 'test1_energy.pptx',
    text: [
      'Reference formula: W = F x d',
      'Reference formula: PE = m g h',
      'Reference formula: KE = 1/2 m v^2',
      'Reference formula: P = W / t',
      'Reference-only formulas on this deck: W = Fd, KE = 1/2mv^2, PE = mgh, P = W/t'
    ].join('\n'),
    sections: [{
      label: 'Slide 4',
      sourceLocation: 'Slide 4',
      pageNumber: 4,
      text: [
        'Reference formula: W = F x d',
        'Reference formula: PE = m g h',
        'Reference formula: KE = 1/2 m v^2',
        'Reference formula: P = W / t',
        'Reference-only formulas on this deck: W = Fd, KE = 1/2mv^2, PE = mgh, P = W/t'
      ].join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: 240, pageCount: 6 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'energy-formula-deterministic-recovery-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'KE = 1/2 m v^2' },
        { ...makeReferenceFormula(), equation: 'P = W / t' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const formulas = generated.referenceFormulas.filter((item) => {
    const canonical = canonicalEquation(item.equation);
    return ['w=f*d', 'pe=mgh', 'ke=1/2mv^2', 'p=w/t'].includes(canonical);
  });
  assert.equal(formulas.length, 4, 'Expected four deterministic Energy reference formulas.');
  const equations = new Set(formulas.map((item) => canonicalEquation(item.equation)));
  assert.ok(equations.has('w=f*d'));
  assert.ok(equations.has('pe=mgh'));
  assert.ok(Array.from(equations).some((entry) => /^ke=/.test(entry) && entry.includes('1/2m') && /v(?:\^2|2)/.test(entry)));
  assert.ok(equations.has('p=w/t'));
  const titles = new Set(formulas.map((item) => item.title));
  assert.ok(titles.has('Work Formula'));
  assert.ok(titles.has('Potential Energy Formula'));
  assert.ok(titles.has('Kinetic Energy Formula'));
  assert.ok(titles.has('Power Formula'));
  const work = formulas.find((item) => canonicalEquation(item.equation) === 'w=f*d');
  const potential = formulas.find((item) => canonicalEquation(item.equation) === 'pe=mgh');
  assert.ok(work);
  assert.ok(potential);
  assert.ok(/w\s*=\s*f\s*(?:×|\*)\s*d/i.test(String(work.equation || '')));
  assert.ok(/pe\s*=\s*m\s*g\s*h/i.test(String(potential.equation || '')));
  assert.equal(formulas.every((item) => item.solverStatus === 'reference_only'), true);
  assert.equal(formulas.every((item) => /deterministic_/.test(String(item.sourceParse || ''))), true);
  assert.equal(formulas.every((item) => item.sourceLocation === 'Slide 4'), true);
  assert.equal(formulas.every((item) => String(item.sourceTextSnippet || '').length > 0), true);

  const combinedOnlyExtraction = writeTempExtraction('energy_formula_combined_list_only.json', {
    ...makeExtraction(),
    fileName: 'test1_energy.pptx',
    text: 'Reference-only formulas on this deck: W = Fd, KE = 1/2mv^2, PE = mgh, P = W/t',
    sections: [{
      label: 'Slide 4',
      sourceLocation: 'Slide 4',
      pageNumber: 4,
      text: 'Reference-only formulas on this deck: W = Fd, KE = 1/2mv^2, PE = mgh, P = W/t'
    }],
    metadata: { detectedType: 'pptx', characterCount: 90, pageCount: 6 }
  });
  const combinedOnlyResult = await generateDraftKnowledgePack({
    extractionJsonPath: combinedOnlyExtraction,
    outputDraftDir: path.join(tempRoot, 'energy-formula-combined-list-only-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });
  assert.equal(combinedOnlyResult.success, true, combinedOnlyResult.errors.join('\n'));
  const combinedOnlyPack = JSON.parse(fs.readFileSync(combinedOnlyResult.outputPath, 'utf8'));
  const combinedOnlyFormulas = combinedOnlyPack.referenceFormulas.filter((item) => {
    const canonical = canonicalEquation(item.equation);
    return ['w=f*d', 'pe=mgh', 'ke=1/2mv^2', 'p=w/t'].includes(canonical);
  });
  assert.equal(combinedOnlyFormulas.length, 4, 'Combined labeled formula list should split into four formulas.');
  assert.equal(combinedOnlyFormulas.every((item) => /Reference-only formulas on this deck:/i.test(String(item.sourceTextSnippet || ''))), true);
  assert.equal(combinedOnlyFormulas.every((item) => item.sourceParse === 'deterministic_labeled_formula_line'), true);
}

async function assertSubjectNeutralKeyFormulaListSplitsIntoReferenceFormulas() {
  const extraction = writeTempExtraction('subject_neutral_key_formulas_split.json', {
    ...makeExtraction(),
    fileName: 'math_reference_sheet.pdf',
    text: 'Key formulas: A = l x w; P = 2l + 2w',
    sections: [{
      label: 'Page 1',
      sourceLocation: 'Page 1',
      pageNumber: 1,
      text: 'Key formulas: A = l x w; P = 2l + 2w'
    }],
    metadata: { detectedType: 'pdf', characterCount: 45, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'subject-neutral-key-formulas-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const formulas = generated.referenceFormulas.filter((item) => ['a=l*w', 'p=2l+2w'].includes(canonicalEquation(item.equation)));
  assert.equal(formulas.length, 2, 'Key formulas labeled list should split into two reference formulas.');
  assert.equal(formulas.every((item) => item.solverStatus === 'reference_only'), true);
  assert.equal(formulas.every((item) => item.sourceParse === 'deterministic_labeled_formula_line'), true);
  assert.equal(formulas.every((item) => /Key formulas:/i.test(String(item.sourceTextSnippet || ''))), true);
}

async function assertVocabularyTermColonDefinitionsAreTrimmed() {
  const extraction = writeTempExtraction('vocabulary_term_colon_definition_trim.json', {
    ...makeExtraction(),
    fileName: 'test2_motion_forces.pptx',
    text: [
      'Slide 5 Motion and Forces',
      'Motion: A change in position over time.',
      'Displacement: The straight-line change in position from start to finish.',
      'Balanced Forces: Equal and opposite forces that produce no net force.',
      'Core Concept: This section introduces examples and images for student discussion.'
    ].join('\n'),
    sections: [{
      label: 'Slide 5',
      sourceLocation: 'Slide 5',
      pageNumber: 5,
      text: [
        'Slide 5 Motion and Forces',
        'Motion: A change in position over time.',
        'Displacement: The straight-line change in position from start to finish.',
        'Balanced Forces: Equal and opposite forces that produce no net force.',
        'Core Concept: This section introduces examples and images for student discussion.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: 340, pageCount: 10 }
  });

  const noisyChunk = 'Slide 5 Motion and Forces Core Concept: this long copied chunk should not become the vocabulary definition when a clean term line exists.';
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'vocabulary-term-colon-definition-trim-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Motion',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 5',
          sourceTextSnippet: noisyChunk
        },
        {
          ...makeVocabularyItem(),
          term: 'Displacement',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 5',
          sourceTextSnippet: noisyChunk
        },
        {
          ...makeVocabularyItem(),
          term: 'Balanced Forces',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 5',
          sourceTextSnippet: noisyChunk
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const motion = findVocabularyByTerm(generated.vocabulary, 'motion');
  const displacement = findVocabularyByTerm(generated.vocabulary, 'displacement');
  const balancedForces = findVocabularyByTerm(generated.vocabulary, 'balanced forces');
  const terms = generated.vocabulary.map((item) => item.term).join(', ');
  assert.ok(motion, `Motion vocabulary should be present. Got: ${terms}`);
  assert.ok(displacement, `Displacement vocabulary should be present. Got: ${terms}`);
  assert.ok(balancedForces, `Balanced Forces vocabulary should be present. Got: ${terms}`);
  assert.equal(motion.studentDefinition, 'A change in position over time');
  assert.equal(displacement.studentDefinition, 'The straight-line change in position from start to finish');
  assert.equal(balancedForces.studentDefinition, 'Equal and opposite forces that produce no net force');
}

async function assertWholeSlideDefinitionsAreNotUsedWhenCleanTermLineExists() {
  const extraction = writeTempExtraction('vocabulary_whole_slide_definition_rejection.json', {
    ...makeExtraction(),
    fileName: 'test2_whole_slide_rejection.pptx',
    text: [
      'Slide 7 Dynamics',
      'Motion: An object changes position over time.',
      'Displacement: Straight-line change from start to finish.',
      'Balanced Forces: Forces that cancel so net force is zero.',
      'Slide 7 Dynamics Core Concept: Students should complete the chart and discussion prompts.'
    ].join('\n'),
    sections: [{
      label: 'Slide 7',
      sourceLocation: 'Slide 7',
      pageNumber: 7,
      text: [
        'Slide 7 Dynamics',
        'Motion: An object changes position over time.',
        'Displacement: Straight-line change from start to finish.',
        'Balanced Forces: Forces that cancel so net force is zero.',
        'Slide 7 Dynamics Core Concept: Students should complete the chart and discussion prompts.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: 320, pageCount: 10 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'vocabulary-whole-slide-definition-rejection-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: 'Motion',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 7',
          sourceTextSnippet: 'Slide 7 Dynamics Core Concept: Students should complete the chart and discussion prompts.'
        },
        {
          ...makeVocabularyItem(),
          term: 'Displacement',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 7',
          sourceTextSnippet: 'Slide 7 Dynamics Core Concept: Students should complete the chart and discussion prompts.'
        },
        {
          ...makeVocabularyItem(),
          term: 'Balanced Forces',
          aliases: [],
          studentDefinition: 'Draft wording not available',
          teacherDefinition: 'Draft wording not available',
          sourceLocation: 'Slide 7',
          sourceTextSnippet: 'Slide 7 Dynamics Core Concept: Students should complete the chart and discussion prompts.'
        }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  generated.vocabulary.forEach((item) => {
    const definition = normalizeLoose(item.studentDefinition);
    assert.equal(definition.startsWith('slide 7'), false);
    assert.equal(definition.includes('core concept'), false);
    assert.equal(definition.includes('students should complete the chart'), false);
  });
}

async function assertMotionForcesDeterministicVocabularyFromSection() {
  const lines = [
    'Vocabulary',
    'Position: where an object is compared to a reference point.',
    'Reference point: place used for comparison.',
    'Motion: change in position over time.',
    'Distance: total path length traveled.',
    'Displacement: straight-line change from start to finish.',
    'Scalar: has size only.',
    'Vector: has size and direction.',
    'Speed: distance traveled per unit of time.',
    'Velocity: speed in a specific direction.',
    'Force: push or pull.',
    'Net force: total combined force on an object.',
    'Friction: force that resists sliding.',
    'Normal force: support force perpendicular to a surface.',
    'Coefficient of friction: number showing how rough or sticky surfaces are.',
    'Formula',
    'Reference formula: speed = distance / time',
    'Reference formula: velocity = displacement / time',
    'Reference formula: a = (vf - vi) / t',
    'Reference formula: Fnet = m × a',
    'Reference formula: Ff = mu × Fn'
  ];
  const extraction = writeTempExtraction('motion_forces_deterministic_vocab.json', {
    ...makeExtraction(),
    fileName: 'test2_motion_forces.pptx',
    text: lines.join('\n'),
    sections: [{
      label: 'Slide 6',
      sourceLocation: 'Slide 6',
      pageNumber: 6,
      text: lines.join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: lines.join('\n').length, pageCount: 10 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'motion-forces-deterministic-vocab-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'Acceleration' }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const terms = new Set(generated.vocabulary.map((item) => normalizeLoose(item.term)));
  [
    'position',
    'distance',
    'displacement',
    'speed',
    'velocity',
    'force',
    'net force',
    'friction',
    'normal force',
    'coefficient of friction'
  ].forEach((term) => assert.ok(terms.has(term), `Expected deterministic vocabulary term: ${term}`));
  assert.equal(terms.has('vocabulary'), false);
  assert.equal(terms.has('v'), false);
  assert.equal(terms.has('i'), false);
  assert.equal(terms.has('r'), false);
  const equations = new Set(generated.referenceFormulas.map((item) => canonicalEquation(item.equation)));
  assert.ok(equations.has('speed=d/time'));
  assert.ok(equations.has('v=displacement/time'));
  assert.ok(equations.has('a=(vf-vi)/t'));
  assert.ok(equations.has('fnet=m*a'));
  assert.ok(equations.has('ff=mu*fn'));
}

async function assertAwkwardConceptTitlesAreCleanedToReadableTitles() {
  const extraction = writeTempExtraction('awkward_concept_titles_cleanup.json', {
    ...makeExtraction(),
    fileName: 'test_concept_titles.pdf',
    text: [
      'A falling object changes potential energy into kinetic energy.',
      'Doing the same work in less time means greater power.',
      'Distance is always positive.',
      'Acceleration happens when speed or direction changes.',
      'Friction usually acts opposite the direction of motion.',
      'Students should choose the correct quantity before solving.',
      'A series circuit has one current path.'
    ].join('\n'),
    sections: [{
      label: 'Page 2',
      sourceLocation: 'Page 2',
      pageNumber: 2,
      text: [
        'A falling object changes potential energy into kinetic energy.',
        'Doing the same work in less time means greater power.',
        'Distance is always positive.',
        'Acceleration happens when speed or direction changes.',
        'Friction usually acts opposite the direction of motion.',
        'Students should choose the correct quantity before solving.',
        'A series circuit has one current path.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 420, pageCount: 4 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'awkward-concept-title-cleanup-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [
        { ...makeConceptItem(), title: 'Falling Object Change', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Doing Same Work', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Distance Alway Positive', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Acceleration Happen Speed', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Friction Usually Act', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Student Should Choose', studentExplanation: 'Draft wording not available' },
        { ...makeConceptItem(), title: 'Sery Circuit', studentExplanation: 'Draft wording not available' }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const titles = new Set(generated.concepts.map((item) => item.title));
  assert.ok(titles.has('Energy Changes in a Falling Object'));
  assert.ok(titles.has('Power and Time'));
  assert.ok(titles.has('Distance Is Always Positive'));
  assert.ok(titles.has('Acceleration and Changing Velocity'));
  assert.ok(titles.has('Friction Opposes Motion'));
  assert.ok(titles.has('Choosing the Correct Quantity'));
  assert.ok(titles.has('Series Circuits'));
}

async function assertBiologyKrebsCycleNotesProduceConceptRecovery() {
  const extraction = writeTempExtraction('biology_krebs_cycle_concept_recovery.json', {
    ...makeExtraction(),
    fileName: 'biology_krebs_cycle_notes.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Vocabulary: ATP, NADH, FADH2, pyruvate',
      'Core Concept: Cellular respiration transfers energy from glucose into ATP.',
      'Procedure / Steps:',
      '1) Glycolysis produces pyruvate in the cytoplasm.',
      '2) Pyruvate enters the mitochondria and becomes acetyl-CoA.',
      '3) The Krebs cycle releases CO2 and produces NADH and FADH2.',
      '4) The electron transport chain uses oxygen as the final electron acceptor and produces most ATP.',
      'Cause and Effect: When oxygen is limited, ATP production drops because electron transport slows.'
    ].join('\n'),
    sections: [{
      label: 'Page 2',
      sourceLocation: 'Page 2',
      pageNumber: 2,
      text: [
        'Vocabulary: ATP, NADH, FADH2, pyruvate',
        'Core Concept: Cellular respiration transfers energy from glucose into ATP.',
        'Procedure / Steps:',
        '1) Glycolysis produces pyruvate in the cytoplasm.',
        '2) Pyruvate enters the mitochondria and becomes acetyl-CoA.',
        '3) The Krebs cycle releases CO2 and produces NADH and FADH2.',
        '4) The electron transport chain uses oxygen as the final electron acceptor and produces most ATP.',
        'Cause and Effect: When oxygen is limited, ATP production drops because electron transport slows.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 620, pageCount: 5 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'biology-krebs-concept-recovery-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [{ ...makeVocabularyItem(), term: 'ATP' }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.concepts.length >= 5, `Expected multiple biology concepts, got ${generated.concepts.length}.`);
  const conceptText = generated.concepts.map((item) => `${item.title} ${item.studentExplanation}`).join(' ').toLowerCase();
  assert.match(conceptText, /cellular respiration/);
  assert.match(conceptText, /pyruvate.{0,40}mitochondr/);
  assert.match(conceptText, /krebs cycle.{0,60}(nadh|fadh2|co2)/);
  assert.match(conceptText, /oxygen.{0,80}(electron acceptor|atp production|electron transport)/);
}

async function assertPlateTectonicsNotesProduceCauseEffectEvidenceConcepts() {
  const extraction = writeTempExtraction('plate_tectonics_concept_recovery.json', {
    ...makeExtraction(),
    fileName: 'plate_tectonics_notes.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Vocabulary: lithosphere, asthenosphere, convergent boundary',
      'Cause and Effect: Convection currents in the mantle move tectonic plates.',
      'Review Items:',
      'Matching fossils and rock layers on distant continents support plate motion.',
      'Seafloor spreading and magnetic stripes show new crust forms at ridges.',
      'Convergent boundaries can cause volcanoes and mountain building.',
      'Transform boundaries often produce earthquakes as plates grind past each other.'
    ].join('\n'),
    sections: [{
      label: 'Page 3',
      sourceLocation: 'Page 3',
      pageNumber: 3,
      text: [
        'Vocabulary: lithosphere, asthenosphere, convergent boundary',
        'Cause and Effect: Convection currents in the mantle move tectonic plates.',
        'Review Items:',
        'Matching fossils and rock layers on distant continents support plate motion.',
        'Seafloor spreading and magnetic stripes show new crust forms at ridges.',
        'Convergent boundaries can cause volcanoes and mountain building.',
        'Transform boundaries often produce earthquakes as plates grind past each other.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 560, pageCount: 4 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'plate-tectonics-concept-recovery-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [{ ...makeVocabularyItem(), term: 'lithosphere' }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.concepts.length >= 4, `Expected plate tectonics concepts, got ${generated.concepts.length}.`);
  const conceptText = generated.concepts.map((item) => `${item.title} ${item.studentExplanation}`).join(' ').toLowerCase();
  assert.match(conceptText, /convection.{0,40}(move|motion).{0,40}plate/);
  assert.match(conceptText, /(fossils|rock layers|magnetic stripes|seafloor spreading).{0,80}(plate motion|new crust)/);
  assert.match(conceptText, /(convergent|transform).{0,80}(earthquake|volcano|mountain)/);
}

async function assertHistoryPeopleEventsDatesProduceConcepts() {
  const extraction = writeTempExtraction('history_people_events_dates_concepts.json', {
    ...makeExtraction(),
    fileName: 'reconstruction_notes.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Vocabulary: Reconstruction, Black Codes, Freedmen\'s Bureau',
      'People / Events / Dates:',
      '1865: The 13th Amendment abolished slavery.',
      '1868: The 14th Amendment granted citizenship and equal protection.',
      'Cause and Effect:',
      'Black Codes restricted rights, which led Congress to pass Reconstruction Acts.',
      'Federal troop withdrawal in 1877 reduced protections for voting rights in the South.'
    ].join('\n'),
    sections: [{
      label: 'Page 4',
      sourceLocation: 'Page 4',
      pageNumber: 4,
      text: [
        'Vocabulary: Reconstruction, Black Codes, Freedmen\'s Bureau',
        'People / Events / Dates:',
        '1865: The 13th Amendment abolished slavery.',
        '1868: The 14th Amendment granted citizenship and equal protection.',
        'Cause and Effect:',
        'Black Codes restricted rights, which led Congress to pass Reconstruction Acts.',
        'Federal troop withdrawal in 1877 reduced protections for voting rights in the South.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 520, pageCount: 6 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'history-concept-recovery-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [{ ...makeVocabularyItem(), term: 'Reconstruction' }],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.concepts.length >= 4, `Expected reconstruction concepts, got ${generated.concepts.length}.`);
  const conceptText = generated.concepts.map((item) => `${item.title} ${item.studentExplanation}`).join(' ').toLowerCase();
  assert.match(conceptText, /13th amendment/);
  assert.match(conceptText, /14th amendment/);
  assert.match(conceptText, /black codes.{0,80}(reconstruction acts|restricted rights)/);
  assert.match(conceptText, /1877|troop withdrawal|voting rights/);
}

async function assertUsefulSectionLabelsAndFragmentsAreRejectedAsVocabularyTerms() {
  const extraction = writeTempExtraction('junk_label_vocabulary_rejection.json', {
    ...makeExtraction(),
    fileName: 'mixed_notes_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Useful vocabulary: mitochondria, ATP, pyruvate',
      'Useful concepts: cellular respiration in mitochondria',
      'Vocabulary:',
      'Mitochondria: organelle where most cellular respiration occurs.',
      'ATP: molecule that stores usable cellular energy.'
    ].join('\n'),
    sections: [{
      label: 'Page 1',
      sourceLocation: 'Page 1',
      pageNumber: 1,
      text: [
        'Useful vocabulary: mitochondria, ATP, pyruvate',
        'Useful concepts: cellular respiration in mitochondria',
        'Vocabulary:',
        'Mitochondria: organelle where most cellular respiration occurs.',
        'ATP: molecule that stores usable cellular energy.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 320, pageCount: 2 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'junk-label-vocabulary-rejection-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'Useful vocabulary' },
        { ...makeVocabularyItem(), term: 'Useful concepts' },
        { ...makeVocabularyItem(), term: 'use' },
        { ...makeVocabularyItem(), term: 'se alignment' },
        { ...makeVocabularyItem(), term: 'Mitochondria' }
      ],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const terms = new Set(generated.vocabulary.map((item) => normalizeLoose(item.term)));
  assert.equal(terms.has('useful vocabulary'), false);
  assert.equal(terms.has('useful concepts'), false);
  assert.equal(terms.has('use'), false);
  assert.equal(terms.has('se alignment'), false);
  assert.equal(terms.has('mitochondria'), true);
}

async function assertCodeExamplesAreRejectedAsReferenceFormulas() {
  const extraction = writeTempExtraction('code_examples_formula_rejection.json', {
    ...makeExtraction(),
    fileName: 'coding_examples_in_notes.txt',
    text: [
      'Examples:',
      'const force = mass * acceleration;',
      'if (x > 0) { return x * x; }',
      'speed = distance / time'
    ].join('\n'),
    sections: [{
      label: 'Chunk 1',
      sourceLocation: 'Chunk 1',
      text: [
        'Examples:',
        'const force = mass * acceleration;',
        'if (x > 0) { return x * x; }',
        'speed = distance / time'
      ].join('\n')
    }],
    metadata: { detectedType: 'txt', characterCount: 130, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'code-example-formula-rejection-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'const force = mass * acceleration' },
        { ...makeReferenceFormula(), equation: 'if (x > 0) { return x * x; }' },
        { ...makeReferenceFormula(), equation: 'speed = distance / time' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const equationText = generated.referenceFormulas.map((item) => String(item.equation || '')).join(' || ');
  assert.equal(/const\s+force|return\s+x|if\s*\(/iu.test(equationText), false);
  assert.ok(generated.referenceFormulas.some((item) => canonicalEquation(item.equation).startsWith('speed=')));
}

async function assertAlgebraWorkedExamplesDoNotBecomeReferenceFormulas() {
  const extraction = writeTempExtraction('algebra_worked_example_formula_rejection.json', {
    ...makeExtraction(),
    fileName: 'algebra_teacher_notes.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Key formulas: y = m x + b',
      'Worked example: y = 2x + 3 = 2(4) + 3 = 11'
    ].join('\n'),
    sections: [{
      label: 'Page 5',
      sourceLocation: 'Page 5',
      pageNumber: 5,
      text: [
        'Key formulas: y = m x + b',
        'Worked example: y = 2x + 3 = 2(4) + 3 = 11'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 90, pageCount: 2 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'algebra-worked-example-formula-rejection-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'y = 2x + 3 = 2(4) + 3 = 11' },
        { ...makeReferenceFormula(), equation: 'y = m x + b' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas.some((item) => /2\s*\(\s*4\s*\)\s*\+\s*3/iu.test(String(item.equation || ''))), false);
  assert.ok(generated.referenceFormulas.some((item) => /y\s*=\s*m\s*(?:x|×|\*)\s*\+\s*b/iu.test(String(item.equation || ''))));
}

async function assertUploadedFormulasRemainReferenceOnly() {
  const extraction = writeTempExtraction('uploaded_formula_reference_only_guardrail.json', {
    ...makeExtraction(),
    fileName: 'chemistry_reference_sheet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: 'Reference formulas: V = I x R; I = V / R; R = V / I',
    sections: [{
      label: 'Page 2',
      sourceLocation: 'Page 2',
      pageNumber: 2,
      text: 'Reference formulas: V = I x R; I = V / R; R = V / I'
    }],
    metadata: { detectedType: 'pdf', characterCount: 56, pageCount: 2 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'uploaded-formula-reference-only-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'V = I x R', solverStatus: 'solvable' },
        { ...makeReferenceFormula(), equation: 'I = V / R', solverStatus: 'solver_ready' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.ok(generated.referenceFormulas.length >= 3);
  assert.equal(generated.referenceFormulas.every((item) => item.solverStatus === 'reference_only'), true);
}

async function assertMotionCoreConceptExtractionAndFormulaFiltering() {
  const extraction = writeTempExtraction('motion_core_concept_extraction.json', {
    ...makeExtraction(),
    fileName: 'motion_forces_packet.pptx',
    text: [
      'Vocabulary: force, net force, scalar, vector',
      'Core Concept: Motion changes when forces are unbalanced.',
      'Balanced forces have net force of 0 N.',
      'Formula: speed = distance/time',
      'Formula: acceleration = change in velocity/time',
      'Formula: Fnet = m × a'
    ].join('\n'),
    sections: [{
      label: 'Slide 2',
      sourceLocation: 'Slide 2',
      pageNumber: 2,
      text: [
        'Vocabulary: force, net force, scalar, vector',
        'Core Concept: Motion changes when forces are unbalanced.',
        'Balanced forces have net force of 0 N.',
        'Formula: speed = distance/time',
        'Formula: acceleration = change in velocity/time',
        'Formula: Fnet = m × a'
      ].join('\n')
    }],
    metadata: { detectedType: 'pptx', characterCount: 280, pageCount: 10 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'motion-core-concept-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'force' },
        { ...makeVocabularyItem(), term: '0 N' },
        { ...makeVocabularyItem(), term: 'F = ma' }
      ],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'displacement = final' },
        { ...makeReferenceFormula(), equation: '100 m in 20 s = 5 m/s' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const vocabTerms = generated.vocabulary.map((item) => item.term.toLowerCase());
  assert.equal(vocabTerms.includes('0 n'), false);
  assert.equal(vocabTerms.includes('f = ma'), false);
  assert.ok(generated.concepts.length > 0, 'Core Concept text should produce concept rows.');
  const equations = new Set(generated.referenceFormulas.map((item) => canonicalEquation(item.equation)));
  assert.equal(equations.has('displacement=final'), false, 'Incomplete equation should be rejected.');
  assert.equal(Array.from(equations).some((entry) => entry.includes('100m') && entry.includes('=5m/s')), false, 'Worked example should be rejected.');
  assert.ok(Array.from(equations).some((entry) => /^speed=/.test(entry) && entry.includes('/')));
  assert.ok(Array.from(equations).some((entry) => /^acceleration=/.test(entry) || entry === 'a=dv/t'));
}

async function assertWorkedExampleFormulaIsRejected() {
  const extraction = writeTempExtraction('worked_example_formula_extraction.json', {
    ...makeExtraction(),
    text: 'Formula examples: 100 m in 20 s = 5 m/s. 10 N + 5 N = 15 N. 12 V / 3 A = 4 ohms. speed = distance / time.',
    sections: [{
      label: 'Slide 4',
      sourceLocation: 'Slide 4',
      pageNumber: 4,
      text: 'Formula examples: 100 m in 20 s = 5 m/s. 10 N + 5 N = 15 N. 12 V / 3 A = 4 ohms. speed = distance / time.'
    }],
    metadata: { detectedType: 'pptx', characterCount: 120, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'worked-example-formula-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: '100 m in 20 s = 5 m/s' },
        { ...makeReferenceFormula(), equation: '10 N + 5 N = 15 N' },
        { ...makeReferenceFormula(), equation: '12 V / 3 A = 4 ohms' },
        { ...makeReferenceFormula(), equation: 'speed = distance / time' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const equations = new Set(generated.referenceFormulas.map((item) => canonicalEquation(item.equation)));
  assert.equal(Array.from(equations).some((entry) => entry.includes('20s') && entry.includes('5m/s')), false);
  assert.equal(Array.from(equations).some((entry) => entry.includes('10n+5n') && entry.includes('15n')), false);
  assert.equal(Array.from(equations).some((entry) => entry.includes('12v/3a') && entry.includes('4ohm')), false);
  assert.ok(Array.from(equations).some((entry) => /^speed=/.test(entry)));
}

async function assertDensityBuoyancyConceptExtractionAndVocabularyFiltering() {
  const extraction = writeTempExtraction('density_buoyancy_extraction.json', {
    ...makeExtraction(),
    fileName: 'density_buoyancy_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Vocabulary: density, buoyancy, displacement',
      'Key Idea: Objects sink or float based on density comparison.',
      'If object density is greater than water density, it sinks.',
      'Main Idea: Water displacement helps determine object volume.',
      'When submerged, displaced water volume equals object volume.',
      'Formula: D = m/V'
    ].join('\n'),
    sections: [{
      label: 'Page 1',
      sourceLocation: 'Page 1',
      pageNumber: 1,
      text: [
        'Vocabulary: density, buoyancy, displacement',
        'Key Idea: Objects sink or float based on density comparison.',
        'If object density is greater than water density, it sinks.',
        'Main Idea: Water displacement helps determine object volume.',
        'When submerged, displaced water volume equals object volume.',
        'Formula: D = m/V'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 340, pageCount: 3 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'density-buoyancy-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [
        { ...makeVocabularyItem(), term: 'density' },
        { ...makeVocabularyItem(), term: 'mass per unit volume' },
        { ...makeVocabularyItem(), term: 'buoyancy' }
      ],
      concepts: [
        { ...makeConceptItem(), title: 'Buoyancy', studentExplanation: 'Draft wording not available' }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const vocabTerms = generated.vocabulary.map((item) => item.term.toLowerCase());
  assert.equal(vocabTerms.includes('mass per unit volume'), false);
  assert.ok(generated.concepts.some((item) => /sink|float|density/i.test(item.title) || /sink|float|density/i.test(item.studentExplanation)));
  assert.ok(generated.concepts.some((item) => /displacement/i.test(item.title) || /displacement/i.test(item.studentExplanation)));
  assert.equal(generated.concepts.some((item) => /draft wording not available/i.test(String(item.studentExplanation || ''))), false);
}

async function assertDensityBuoyancyRecoversSinkFloatAndDisplacementConcepts() {
  const extraction = writeTempExtraction('density_buoyancy_recovery_concepts.json', {
    ...makeExtraction(),
    fileName: 'test3_density_buoyancy.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'If an object is denser than the fluid, it usually sinks.',
      'If an object is less dense than the fluid, it usually floats.',
      'Water displacement can be used to find volume.',
      'Buoyant force depends on the amount of fluid displaced by the object.'
    ].join('\n'),
    sections: [{
      label: 'Page 3',
      sourceLocation: 'Page 3',
      pageNumber: 3,
      text: [
        'If an object is denser than the fluid, it usually sinks.',
        'If an object is less dense than the fluid, it usually floats.',
        'Water displacement can be used to find volume.',
        'Buoyant force depends on the amount of fluid displaced by the object.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 290, pageCount: 3 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'density-buoyancy-recovery-concepts-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [
        { ...makeConceptItem(), title: 'Object Greater Density', studentExplanation: 'Draft wording not available' }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  const conceptText = generated.concepts.map((item) => `${item.title} ${item.studentExplanation}`).join(' || ');
  assert.ok(/denser than the fluid usually sink/i.test(conceptText));
  assert.ok(/less dense than the fluid usually float/i.test(conceptText));
  assert.ok(/water displacement/i.test(conceptText) && /volume/i.test(conceptText));
  assert.ok(/buoyant force/i.test(conceptText) && /displaced/i.test(conceptText));
}

async function assertElectricityMagnetismFormulaRepairAndConceptWordingRecovery() {
  const extraction = writeTempExtraction('electricity_magnetism_extraction.json', {
    ...makeExtraction(),
    fileName: 'electricity_magnetism_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Larger PDF: Electricity and Magnetism Page 6 of 12',
      'Charlemagne text-based PDF import test',
      'Main Idea: Current depends on voltage and resistance in a circuit.',
      'Concept Check: Explain how conductors and insulators affect current.',
      'Reference-only formulas: V = I x R. It can also be written as I = V / R or R = V / I.',
      'Formula: P = I × V'
    ].join('\n'),
    sections: [{
      label: 'Page 8',
      sourceLocation: 'Page 8',
      pageNumber: 8,
      text: [
        'Larger PDF: Electricity and Magnetism Page 6 of 12',
        'Charlemagne text-based PDF import test',
        'Main Idea: Current depends on voltage and resistance in a circuit.',
        'Concept Check: Explain how conductors and insulators affect current.',
        'Reference-only formulas: V = I x R. It can also be written as I = V / R or R = V / I.',
        'Formula: P = I × V'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 300, pageCount: 12 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'electricity-magnetism-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      concepts: [
        { ...makeConceptItem(), title: 'Ohm Law Concept', studentExplanation: 'Draft wording not available' }
      ],
      referenceFormulas: [
        { ...makeReferenceFormula(), equation: 'The reference formula is V = I' },
        { ...makeReferenceFormula(), equation: 'x R. It can also be written as I = V / R or R = V / I' }
      ],
      vocabulary: [
        { ...makeVocabularyItem(), term: 'voltage' },
        { ...makeVocabularyItem(), term: 'x R' },
        { ...makeVocabularyItem(), term: 'V' },
        { ...makeVocabularyItem(), term: 'I' },
        { ...makeVocabularyItem(), term: 'R' }
      ],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.some((item) => normalizeLoose(item.term) === 'x r'), false);
  assert.equal(generated.vocabulary.some((item) => ['v', 'i', 'r'].includes(normalizeLoose(item.term))), false);
  assert.equal(generated.concepts.some((item) => /draft wording not available/i.test(String(item.studentExplanation || ''))), false);
  assert.equal(generated.concepts.some((item) => /larger pdf|page 6 of 12|charlemagne text-based pdf import test/i.test(String(item.studentExplanation || ''))), false);
  const equations = new Set(generated.referenceFormulas.map((item) => canonicalEquation(item.equation)));
  assert.ok(equations.has('v=i*r'));
  assert.ok(equations.has('i=v/r'));
  assert.ok(equations.has('r=v/i'));
  assert.equal(equations.has('v=i'), false);
  const titles = new Set(generated.referenceFormulas.map((item) => item.title));
  assert.ok(titles.has('Ohm’s Law Voltage Formula'));
  assert.ok(titles.has('Ohm’s Law Current Formula'));
  assert.ok(titles.has('Ohm’s Law Resistance Formula'));
}

async function assertLearningTargetSentenceDoesNotBecomeUglyConceptTitle() {
  const extraction = writeTempExtraction('learning_target_title_cleanup_extraction.json', {
    ...makeExtraction(),
    text: [
      'Students should explain electric charge using evidence from the circuit or magnetic situation.',
      'Like charges repel and opposite charges attract.'
    ].join('\n'),
    sections: [{
      label: 'Page 9',
      sourceLocation: 'Page 9',
      pageNumber: 9,
      text: [
        'Students should explain electric charge using evidence from the circuit or magnetic situation.',
        'Like charges repel and opposite charges attract.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 140, pageCount: 1 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'learning-target-title-cleanup-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [
        {
          ...makeConceptItem(),
          title: 'Students should explain electric charge using evidence from the circuit or magnetic situation.',
          studentExplanation: 'Students should explain electric charge using evidence from the circuit or magnetic situation.'
        }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.concepts.some((item) => /^Students should explain/iu.test(String(item.title || ''))), false);
  assert.ok(generated.concepts.some((item) => item.title === 'Electric Charge Interactions'));
}

async function assertLearningTargetConceptExplanationIsRecoveredFromNearbySourceText() {
  const extraction = writeTempExtraction('learning_target_explanation_recovery.json', {
    ...makeExtraction(),
    fileName: 'test4_learning_targets.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: [
      'Students should explain electric charge using evidence from the investigation.',
      'Like charges repel and opposite charges attract.',
      'Students should explain ohm\'s law using evidence from circuit data.',
      'Ohm\'s law relates voltage, current, and resistance.',
      'Students should explain series circuits.',
      'A series circuit has one current path, and current stops everywhere if the circuit opens.'
    ].join('\n'),
    sections: [{
      label: 'Page 11',
      sourceLocation: 'Page 11',
      pageNumber: 11,
      text: [
        'Students should explain electric charge using evidence from the investigation.',
        'Like charges repel and opposite charges attract.',
        'Students should explain ohm\'s law using evidence from circuit data.',
        'Ohm\'s law relates voltage, current, and resistance.',
        'Students should explain series circuits.',
        'A series circuit has one current path, and current stops everywhere if the circuit opens.'
      ].join('\n')
    }],
    metadata: { detectedType: 'pdf', characterCount: 430, pageCount: 12 }
  });

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extraction,
    outputDraftDir: path.join(tempRoot, 'learning-target-explanation-recovery-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [],
      concepts: [
        {
          ...makeConceptItem(),
          title: 'Students should explain electric charge using evidence from the investigation.',
          studentExplanation: 'Students should explain electric charge using evidence from the investigation.'
        },
        {
          ...makeConceptItem(),
          title: 'Students should explain ohm\'s law using evidence from circuit data.',
          studentExplanation: 'Students should explain ohm\'s law using evidence from circuit data.'
        },
        {
          ...makeConceptItem(),
          title: 'Students should explain series circuits.',
          studentExplanation: 'Students should explain series circuits.'
        }
      ],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.concepts.some((item) => /^Students should explain/iu.test(String(item.studentExplanation || ''))), false);
  const text = generated.concepts.map((item) => `${item.title} ${item.studentExplanation}`).join(' || ');
  assert.ok(/Electric Charge Interactions/i.test(text));
  assert.ok(/like charges repel/i.test(text) && /opposite charges attract/i.test(text));
  assert.ok(/Ohm/i.test(text) && /voltage/i.test(text) && /current/i.test(text) && /resistance/i.test(text));
  assert.ok(/Series Circuits/i.test(text));
  assert.ok(/one current path/i.test(text) && /opens?/i.test(text));
}

async function assertReviewItemsPreferOriginalUploadedFilename() {
  const originalNamePath = writeTempExtraction('original_filename_energy_extraction.json', {
    ...makeExtraction(),
    upload: {
      uploadId: 'upload-original-name',
      originalFileName: 'Original Energy Packet.pdf',
      storedFileName: 'upload-original-name.pdf',
      extractionJsonFileName: 'upload-original-name_extraction.json'
    },
    fileName: 'upload-original-name.pdf'
  });

  const item = {
    ...makeVocabularyItem(),
    sourceFile: 'upload-original-name.pdf'
  };
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: originalNamePath,
    outputDraftDir: path.join(tempRoot, 'original-filename-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      vocabulary: [item],
      concepts: [],
      referenceFormulas: [],
      problemBank: [],
      standardsMap: [],
      smokeTests: []
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].sourceFile, 'Original Energy Packet.pdf');
  assert.equal(generated.metadata.sourceUpload.originalFileName, 'Original Energy Packet.pdf');
}

async function assertRequiredFactFieldsAreStillRejected() {
  const outputDraftDir = path.join(tempRoot, 'missing-facts-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-missing-facts-draft',
      referenceFormulas: [
        {
          ...makeReferenceFormula(),
          equation: ''
        }
      ],
      problemBank: [
        {
          ...makeProblemItem(),
          expectedAnswer: ''
        }
      ]
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('problemBank[0].expectedAnswer must be a non-empty string.')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  const debug = JSON.parse(fs.readFileSync(result.rawModelResponsePath, 'utf8'));
  assert.ok(debug.normalizedDraftAttempt.referenceFormulas[0].equation.includes('F = m * a'));
  assert.equal(debug.normalizedDraftAttempt.problemBank[0].expectedAnswer, '');
  assert.equal(fs.existsSync(outputDraftDir), false);
}

async function assertRetryInvalidJsonCanRepairDraft() {
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'retry-drafts'),
    retryInvalidJson: true,
    modelClient: async ({ prompt }) => {
      calls.push(prompt);
      return calls.length === 1
        ? '{"packId":"broken",'
        : JSON.stringify(makeGeneratedPack({ packId: 'generated-retry-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-retry-draft');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('Convert the following attempted response into valid JSON.'));
  assert.ok(calls[1].includes('Return JSON only. Do not add new facts.'));
  assert.ok(calls[1].includes('"uncertainSections":[]'));
}

async function assertInvalidStandardsAreRejected() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    standardsBankPath,
    outputDraftDir: path.join(tempRoot, 'invalid-standard-drafts'),
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-invalid-standard-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          standards: ['SAMPLE.PS.UNKNOWN.1']
        }
      ],
      standardsMap: [
        {
          standardId: 'SAMPLE.PS.UNKNOWN.1',
          description: 'Invented standard',
          relatedVocabulary: ['force'],
          relatedConcepts: [],
          reviewStatus: 'pending',
          confidence: 'low'
        }
      ]
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('unknown standard reference')));
}

function assertApprovedPacksAreNotModified() {
  const loadResult = loadApprovedKnowledgePacks({ approvedPacksDir });
  assert.equal(loadResult.errors.length, 0, loadResult.errors.map((error) => error.errors.join('\n')).join('\n'));
  assert.deepEqual(snapshotApprovedPacks(), approvedPacksBefore, 'approved-packs should not be modified by generation tests');
}

function snapshotApprovedPacks() {
  const snapshot = {};
  walkFiles(approvedPacksDir).forEach((filePath) => {
    snapshot[path.relative(approvedPacksDir, filePath)] = fs.readFileSync(filePath, 'utf8');
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

function mockHttpRequest(handler) {
  const originalRequest = http.request;
  http.request = handler;
  return () => {
    http.request = originalRequest;
  };
}

function makeExtraction() {
  return {
    success: true,
    filePath: '/tmp/teacher_force_notes.txt',
    fileName: 'teacher_force_notes.txt',
    extension: '.txt',
    mimeGuess: 'text/plain',
    text: 'Force is a push or pull. Net force can change motion. The formula F = m * a relates force, mass, and acceleration.',
    sections: [
      {
        label: 'Full Text',
        text: 'Force is a push or pull. Net force can change motion. The formula F = m * a relates force, mass, and acceleration.'
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: 113
    },
    warnings: [],
    errors: []
  };
}

function writeTempExtraction(fileName, extraction) {
  const filePath = path.join(tempRoot, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(extraction, null, 2)}\n`);
  return filePath;
}

function makeWordProblemOnlyExtraction() {
  const text = [
    'Potential Energy Practice',
    'A crate is raised onto a platform. Calculate the work done by the lift.',
    'A go-cart climbs a ramp while the motor provides constant power.'
  ].join('\n');
  return {
    success: true,
    filePath: '/tmp/potential_energy_word_problems.pdf',
    fileName: 'potential_energy_word_problems.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text,
    sections: [
      {
        label: 'Page 3',
        sourceLocation: 'Page 3',
        pageNumber: 3,
        text
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'pdf',
      characterCount: text.length,
      pageCount: 1
    },
    warnings: [],
    errors: []
  };
}

function makePotentialEnergyVocabularyItem() {
  return {
    ...makeVocabularyItem(),
    term: 'Potential Energy',
    aliases: [],
    studentDefinition: 'Potential energy is stored energy due to position.',
    teacherDefinition: 'Potential energy is energy stored in an object because of position or configuration.',
    sourceFile: 'potential_energy_word_problems.pdf',
    sourceLocation: 'Page 3',
    sourceTextSnippet: 'Potential Energy Practice A crate is raised onto a platform. Calculate the work done by the lift. A go-cart climbs a ramp while the motor provides constant power.',
    reviewStatus: 'approved',
    confidence: 'high'
  };
}

function makeMultiChunkExtraction() {
  return {
    success: true,
    filePath: '/tmp/synthetic_packet.txt',
    fileName: 'synthetic_packet.txt',
    extension: '.txt',
    mimeGuess: 'text/plain',
    text: [
      'Vocabulary: Chunk 1 term means the first source-supported idea.',
      'Concepts: Chunk 2 concept explains the second source-supported idea.',
      'Practice Problems: Chunk 3 includes a practice prompt.'
    ].join('\n\n'),
    sections: [
      {
        label: 'Chunk 1',
        sourceLocation: 'Chunk 1',
        text: 'Vocabulary: Chunk 1 term means the first source-supported idea.'
      },
      {
        label: 'Chunk 2',
        sourceLocation: 'Chunk 2',
        text: 'Concepts: Chunk 2 concept explains the second source-supported idea.'
      },
      {
        label: 'Chunk 3',
        sourceLocation: 'Chunk 3',
        text: 'Practice Problems: Chunk 3 includes a practice prompt.'
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: 176,
      pageCount: 3
    },
    warnings: [],
    errors: []
  };
}

function makeExtractionWithEmptyChunk() {
  return {
    success: true,
    filePath: '/tmp/empty_chunk_packet.pdf',
    fileName: 'empty_chunk_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: 'Page 1 has extractable vocabulary text.',
    sections: [
      {
        label: 'Page 1',
        sourceLocation: 'Page 1',
        pageNumber: 1,
        text: 'Page 1 has extractable vocabulary text.'
      },
      {
        label: 'Page 2',
        sourceLocation: 'Page 2',
        pageNumber: 2,
        text: ''
      }
    ],
    pages: [
      {
        pageNumber: 1,
        text: 'Page 1 has extractable vocabulary text.'
      },
      {
        pageNumber: 2,
        text: ''
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'pdf',
      characterCount: 37,
      pageCount: 2
    },
    warnings: [],
    errors: []
  };
}

function makeLargePdfExtraction(options = {}) {
  const pageCount = Number(options.pages || 29);
  const charactersPerPage = Number(options.charactersPerPage || 1200);
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const seed = `Synthetic energy page ${pageNumber}. Vocabulary: page-${pageNumber}-term. Concept: page ${pageNumber} explains energy practice with source-supported details. `;
    return {
      pageNumber,
      text: seed.repeat(Math.ceil(charactersPerPage / seed.length)).slice(0, charactersPerPage)
    };
  });
  const text = pages.map((page) => page.text).join('\n\n');
  return {
    success: true,
    filePath: '/tmp/large_energy_packet.pdf',
    fileName: 'large_energy_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text,
    pages,
    sections: [
      {
        label: 'Full Text',
        sourceLocation: 'Full Text',
        text
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'pdf',
      characterCount: text.length,
      pageCount
    },
    warnings: [],
    errors: []
  };
}

function makeAdaptiveLoopExtraction() {
  const sections = [
    {
      label: 'Page 1',
      sourceLocation: 'Page 1',
      pageNumber: 1,
      text: 'Vocabulary ADAPTIVE_PAGE_1_TOKEN: energy means capacity to do work.'
    },
    {
      label: 'Page 2',
      sourceLocation: 'Page 2',
      pageNumber: 2,
      text: 'Concept ADAPTIVE_PAGE_2_TOKEN: kinetic energy depends on motion.'
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
      text: 'Formula section ADAPTIVE_PAGE_5_TOKEN with enough text to queue and then fail in adaptive loop.'
    },
    {
      label: 'Page 6',
      sourceLocation: 'Page 6',
      pageNumber: 6,
      text: 'Definitions page ADAPTIVE_PAGE_6_TOKEN that may produce no vocabulary, concept, or formula items.'
    }
  ];
  const pages = sections.map((section) => ({
    pageNumber: section.pageNumber,
    text: section.text
  }));
  return {
    success: true,
    filePath: '/tmp/adaptive_loop_packet.pdf',
    fileName: 'adaptive_loop_packet.pdf',
    extension: '.pdf',
    mimeGuess: 'application/pdf',
    text: sections.map((section) => section.text).join('\n\n'),
    sections,
    pages,
    tables: [],
    metadata: {
      detectedType: 'pdf',
      characterCount: sections.reduce((sum, section) => sum + section.text.length, 0),
      pageCount: 6
    },
    warnings: [],
    errors: []
  };
}

function makeFormulaExtraction() {
  const text = 'Formula: v = d / t where v is speed, d is distance, and t is time.';
  return {
    success: true,
    filePath: '/tmp/formula_source.txt',
    fileName: 'formula_source.txt',
    extension: '.txt',
    mimeGuess: 'text/plain',
    text,
    sections: [
      {
        label: 'Page 1',
        sourceLocation: 'Page 1',
        pageNumber: 1,
        text
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: text.length,
      pageCount: 1
    },
    warnings: [],
    errors: []
  };
}

function makePptxExtraction() {
  const pages = [
    {
      label: 'Slide 1',
      sourceLocation: 'Slide 1',
      pageNumber: 1,
      text: ''
    },
    {
      label: 'Slide 2',
      sourceLocation: 'Slide 2',
      pageNumber: 2,
      text: 'Formula: v = d / t where v is speed, d is distance, and t is time.'
    },
    {
      label: 'Slide 3',
      sourceLocation: 'Slide 3',
      pageNumber: 3,
      text: 'Kinetic energy is energy of motion.'
    }
  ];
  const text = pages.filter((page) => page.text).map((page) => page.text).join('\n\n');
  return {
    success: true,
    filePath: '/tmp/teacher_energy_slides.pptx',
    fileName: 'teacher_energy_slides.pptx',
    extension: '.pptx',
    mimeGuess: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    text,
    pages,
    sections: pages,
    tables: [],
    metadata: {
      detectedType: 'pptx',
      parser: 'pptx-ooxml',
      characterCount: text.length,
      slideCount: 3,
      pageCount: 3,
      textBearingPages: [2, 3],
      pagesWithText: [2, 3],
      textBearingSlides: [2, 3],
      firstTextPage: 2,
      firstTextSlide: 2,
      hasImagesOrMedia: false
    },
    warnings: [],
    errors: []
  };
}

function makeGeneratedPack(overrides = {}) {
  return {
    packId: 'generated-force-draft',
    title: 'Generated Force Draft',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'pending',
        confidence: 'medium',
        notes: 'Generated from extracted text for teacher review.'
      }
    ],
    vocabulary: [makeVocabularyItem()],
    concepts: [makeConceptItem()],
    referenceFormulas: [makeReferenceFormula()],
    problemBank: [makeProblemItem()],
    standardsMap: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        description: 'Describe how balanced and unbalanced forces affect motion.',
        relatedVocabulary: ['force'],
        relatedConcepts: ['net-force-changes-motion'],
        reviewStatus: 'pending',
        confidence: 'medium'
      }
    ],
    smokeTests: [
      {
        question: 'What is force?',
        expectedAnswer: 'Force is a push or pull.',
        reviewStatus: 'pending',
        confidence: 'medium'
      }
    ],
    metadata: {
      createdBy: 'test-model-client',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
      notes: 'Generated draft. Requires teacher review before promotion.'
    },
    ...overrides
  };
}

function makeVocabularyItemForPage(page) {
  return {
    ...makeVocabularyItem(),
    vocabularyId: `page-${page}-term`,
    term: `page-${page}-term`,
    sourceFile: 'large_energy_packet.pdf',
    sourceLocation: `Page ${page}`,
    sourceTextSnippet: `Synthetic energy page ${page}`
  };
}

function makeConceptItemForPage(page) {
  return {
    ...makeConceptItem(),
    conceptId: `page-${page}-concept`,
    title: `Page ${page} Concept`,
    sourceFile: 'large_energy_packet.pdf',
    sourceLocation: `Page ${page}`,
    sourceTextSnippet: `Synthetic energy page ${page}`
  };
}

function makeVocabularyItem() {
  return {
    term: 'force',
    aliases: ['push or pull'],
    studentDefinition: 'A force is a push or pull.',
    teacherDefinition: 'A force is an interaction that can change motion.',
    misconception: '',
    exampleQuestion: 'What can change motion?',
    exampleAnswer: 'A force can change motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeVocabularyItemForChunk(index) {
  return {
    ...makeVocabularyItem(),
    term: `chunk-${index}-term`,
    aliases: [],
    studentDefinition: `Chunk ${index} term definition from the source.`,
    teacherDefinition: `Chunk ${index} term teacher definition from the source.`,
    standards: [],
    confidence: 'low',
    sourceFile: 'synthetic_packet.txt',
    sourceLocation: `Chunk ${index}`,
    sourceTextSnippet: `Chunk ${index} term means the first source-supported idea.`
  };
}

function makeConceptItem() {
  return {
    conceptId: 'net-force-changes-motion',
    title: 'Net Force Changes Motion',
    aliases: [],
    studentExplanation: 'Net force can change how an object moves.',
    keyIdeas: ['Net force can change motion.'],
    examples: ['A push can start an object moving.'],
    nonExamples: [],
    commonMisconceptions: [],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force can change motion.'
  };
}

function makeConceptItemForChunk(index) {
  return {
    ...makeConceptItem(),
    conceptId: `chunk-${index}-concept`,
    title: `Chunk ${index} Concept`,
    standards: [],
    confidence: 'low',
    sourceFile: 'synthetic_packet.txt',
    sourceLocation: `Chunk ${index}`,
    sourceTextSnippet: index === 2
      ? 'Chunk 2 concept explains the second source-supported idea.'
      : `Chunk ${index} term means the first source-supported idea.`
  };
}

function makeReferenceFormula() {
  return {
    formulaId: 'force-reference',
    title: 'Force Reference',
    equation: 'F = m * a',
    variables: [
      {
        symbol: 'F',
        meaning: 'force'
      },
      {
        symbol: 'm',
        meaning: 'mass'
      },
      {
        symbol: 'a',
        meaning: 'acceleration'
      }
    ],
    studentExplanation: 'The formula relates force, mass, and acceleration.',
    solverStatus: 'reference_only',
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'The formula F = m * a relates force, mass, and acceleration.'
  };
}

function makeProblemItem() {
  return {
    problemId: 'force-definition-problem',
    question: 'What is a force?',
    expectedAnswer: 'A force is a push or pull.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeProblemItemForChunk(index) {
  return {
    ...makeProblemItem(),
    problemId: `chunk-${index}-problem`,
    question: `Synthetic source question ${index}?`,
    expectedAnswer: `Synthetic source answer ${index}.`,
    standards: [],
    confidence: 'low',
    sourceFile: 'synthetic_packet.txt',
    sourceLocation: `Chunk ${index}`,
    sourceTextSnippet: index === 3
      ? 'Chunk 3 includes a practice prompt.'
      : `Chunk ${index} term means the first source-supported idea.`
  };
}

function makeDefaultStandardsMetadata() {
  return {
    linkedStandardIds: [],
    suggestedStandardIds: [],
    alignmentStatus: 'not_aligned_yet',
    alignmentSource: 'none'
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
        keywords: ['balanced forces', 'unbalanced forces', 'net force'],
        questionTriggers: ['balanced forces', 'unbalanced forces', 'net force'],
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

function canonicalEquation(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/velocity/g, 'v')
    .replace(/distance/g, 'd')
    .replace(/changeinvelocity/g, 'changeinvelocity');
}

function findVocabularyByTerm(vocabulary, term) {
  const target = normalizeLoose(term).replace(/[^a-z0-9 ]+/g, '');
  return (Array.isArray(vocabulary) ? vocabulary : []).find((item) => {
    const candidate = normalizeLoose(item && item.term).replace(/[^a-z0-9 ]+/g, '');
    if (!candidate || !target) return false;
    return candidate === target || candidate.includes(target) || target.includes(candidate);
  });
}

function normalizeLoose(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function restoreEnvVar(name, previousValue) {
  if (previousValue === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = previousValue;
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, {
    recursive: true,
    force: true
  });
}
