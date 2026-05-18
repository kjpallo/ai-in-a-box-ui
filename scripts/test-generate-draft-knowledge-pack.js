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
  makeSelectedExtraction
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
    assertPromptIncludesStandardsList();
    await assertDefaultTimeoutAndKeepAliveReachModelClient();
    await assertCustomTimeoutAndKeepAliveReachModelClient();
    await assertOllamaRequestIncludesKeepAliveAndUsesTimeout();
    await assertModelCallsUseDeterministicOptions();
    await assertOllamaTimeoutReturnsUsefulError();
    await assertValidMockCreatesDraft();
    await assertMultiChunkUploadMergesBatchDrafts();
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
    await assertPreviewValidationFailureReturnsSalvagedPreview();
    await assertSelectedPageRangeProcessesOnlySelectedPages();
    await assertModelCallsStaySequential();
    await assertModelCrashRetriesWithSmallerChunks();
    await assertRetryFailureReportsBatchCoverage();
    await assertCodeFencedJsonCreatesDraft();
    await assertExtraTextAroundJsonCreatesDraftWhenUnambiguous();
    await assertItemOnlyModelOutputGetsWrappedFromKnowledgeName();
    await assertMissingMetadataIsNormalizedAndValidates();
    await assertMissingTopLevelArraysAreNormalizedAndValidate();
    await assertVocabularyReviewStatusIsNormalized();
    await assertFormulaSolverStatusIsNormalized();
    await assertConceptStructuralFieldsAreNormalized();
    await assertConceptIdDerivedFromClaim();
    await assertConceptTitleDerivedFromSummary();
    await assertVocabularyTermAndIdAreNormalized();
    await assertSourceLessItemsAreKeptPendingReview();
    await assertRequiredFactFieldsAreStillRejected();
    await assertInvalidMockJsonReturnsUsefulError();
    await assertRetryInvalidJsonCanRepairDraft();
    await assertInvalidStandardsAreRejected();
    assertRawInvalidPacketStillFailsValidator();
    assertApprovedPacksAreNotModified();
  } finally {
    cleanupTempRoot();
  }

  console.log('Draft knowledge pack generation tests passed.');
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

  assert.ok(prompt.includes('Do not invent facts.'));
  assert.ok(prompt.includes('Do not invent standards.'));
  assert.ok(prompt.includes('Use only the provided extracted text.'));
  assert.ok(prompt.includes('Do not add outside examples, outside definitions, outside standards, or outside problem details.'));
  assert.ok(prompt.includes('solverStatus: "reference_only"'));
  assert.ok(prompt.includes('Do not create solver code.'));
  assert.ok(prompt.includes('Do not describe solver logic.'));
  assert.ok(prompt.includes('Every generated vocabulary, concept, referenceFormula, and problemBank item must include sourceFile, sourceLocation, sourceTextSnippet, confidence, and reviewStatus.'));
  assert.ok(prompt.includes('Only include vocabulary terms explicitly present in the provided source text.'));
  assert.ok(prompt.includes('Every vocabulary sourceTextSnippet must contain the term itself or very close wording from the source.'));
  assert.ok(prompt.includes('Formulas may be included only as referenceFormulas.'));
  assert.ok(prompt.includes('Vocabulary = a named term, unit, variable, abbreviation, or phrase explicitly defined in the source text.'));
  assert.ok(prompt.includes('Concept = a larger idea, relationship, category, process, or explanation supported by the source text.'));
  assert.ok(prompt.includes('Reference formula = equation-like text, formula line, symbolic relationship, or unit relationship from the source.'));
  assert.ok(prompt.includes('Problem bank = a worked example, practice question, exercise, or check-for-understanding prompt with an answer or expected answer from the source.'));
  assert.ok(prompt.includes('The same phrase may appear once in vocabulary and once in concepts when the source supports both roles.'));
  assert.ok(prompt.includes('Do not dedupe across vocabulary and concepts'));
  assert.ok(prompt.includes('Preserve abbreviations shown in parentheses as aliases'));
  assert.ok(prompt.includes('Treat simple singular/plural variants as the same vocabulary term'));
  assert.ok(prompt.includes('Uploaded/reference formulas are for teacher review only and must not claim or imply built-in solver support.'));
  assert.ok(prompt.includes('reviewStatus: "pending" and confidence: "low"'));
  assert.ok(prompt.includes('Return valid JSON only.'));
  assert.ok(prompt.includes('Return one JSON object only.'));
  assert.ok(prompt.includes('Do not use markdown.'));
  assert.ok(prompt.includes('Do not wrap the JSON in triple backticks.'));
  assert.ok(prompt.includes('Escape all quotation marks inside string values.'));
  assert.ok(prompt.includes('Do not include comments or trailing commas.'));
  assert.ok(prompt.includes('"sourceFiles": []'));
  assert.ok(prompt.includes('"referenceFormulas": []'));
  assert.ok(prompt.includes('"problemBank": []'));
  assert.ok(prompt.includes('"standardsMap": []'));
  assert.ok(prompt.includes('"smokeTests": []'));
  assert.ok(prompt.includes('"metadata": {}'));
  assert.ok(prompt.includes('Vocabulary items must use this minimal object shape:'));
  assert.ok(prompt.includes('Concept items must use this minimal object shape:'));
}

function assertPromptIncludesStandardsList() {
  const prompt = buildKnowledgePackPrompt({
    extraction: makeExtraction(),
    standardsBank: makeStandardsBank()
  });

  assert.ok(prompt.includes('Available standards bank:'));
  assert.ok(prompt.includes('SAMPLE.PS.FORCES.1'));
  assert.ok(prompt.includes('You may only use standardIds from the available standards bank above.'));
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
  assert.equal(result.inputSnapshot.promptVersion, 'teacher-content-draft-v2');
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
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.problemBank[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
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

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary.length, 3);
  assert.equal(generated.concepts.length, 3);
  assert.equal(generated.problemBank.length, 3);
  assert.equal(generated.metadata.importBatches, 3);
  assert.equal(generated.metadata.importCoverage.processedChunks, 3);
  assert.equal(generated.vocabulary[1].sourceLocation, 'Chunk 2');
  assert.equal(generated.problemBank[2].sourceTextSnippet, 'Chunk 3 includes a practice prompt.');
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
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
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
      const pageMatch = prompt.match(/Page (\d+)/);
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
        equation: ''
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
  assert.ok(previewResult.invalidItems.length >= 2);
  assert.ok(previewResult.previewReport.invalidItems.some((entry) => entry.section === 'referenceFormulas'));
  assert.ok(previewResult.previewReport.invalidItems.some((entry) => entry.section === 'problemBank'));
  assert.ok(previewResult.previewReport.validationErrors.includes('referenceFormulas[0].equation must be a non-empty string.'));
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
  assert.ok(fullResult.errors.includes('referenceFormulas[0].equation must be a non-empty string.'));
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
  assert.equal(generated.metadata.importCoverage.totalPages, 3);
  assert.equal(generated.vocabulary[0].sourceLocation, 'Page 2');
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
  assert.ok(result.errors.some((error) => error.includes('Gemma crashed while reading batch 1')));
  assert.ok(result.errors.some((error) => error.includes('retried with smaller chunks')));
  assert.ok(result.coverageReport.failedBatches.length >= 1);
  assert.ok(result.coverageReport.warnings.some((warning) => warning.includes('Model draft failed for batch 1')));
  assert.ok(result.timeline.some((event) => event.type === 'error' && event.message.includes('Gemma crashed while reading batch 1')));
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
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.vocabulary[0].confidence, 'low');
  assert.deepEqual(generated.vocabulary[0].standards, []);
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
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].confidence, 'low');
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
  assert.deepEqual(generated.concepts[0].standards, []);
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].confidence, 'low');
  assert.equal(generated.concepts[0].sourceFile, 'teacher_force_notes.txt');
  assert.equal(generated.concepts[0].sourceLocation, 'extracted text');
  assert.ok(generated.concepts[0].sourceTextSnippet.includes('Force is a push or pull.'));
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
  assert.equal(generated.concepts[0].title, 'Net force changes motion');
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
  assert.equal(generated.concepts[0].title, 'Balanced forces do not change an object motion');
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

async function assertSourceLessItemsAreKeptPendingReview() {
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
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].confidence, 'low');
  assert.equal(generated.concepts[0].sourceFile, 'teacher_force_notes.txt');
  assert.ok(generated.concepts[0].normalizationNotes.some((note) => note.includes('Source evidence was filled')));
  assert.ok(generated.metadata.importNormalization.sourceEvidenceFilled >= 1);
  assert.ok(generated.metadata.importNormalization.reviewNeededItems >= 1);
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
  assert.ok(result.errors.some((error) => error.includes('referenceFormulas[0].equation must be a non-empty string.')));
  assert.ok(result.errors.some((error) => error.includes('problemBank[0].expectedAnswer must be a non-empty string.')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  const debug = JSON.parse(fs.readFileSync(result.rawModelResponsePath, 'utf8'));
  assert.equal(debug.normalizedDraftAttempt.referenceFormulas[0].equation, '');
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
  assert.ok(calls[1].includes('Convert the following attempted response into valid JSON matching the required schema.'));
  assert.ok(calls[1].includes('Return JSON only. Do not add new facts.'));
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

function cleanupTempRoot() {
  fs.rmSync(tempRoot, {
    recursive: true,
    force: true
  });
}
