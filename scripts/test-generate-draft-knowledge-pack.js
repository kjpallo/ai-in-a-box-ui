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
  buildImportEstimate,
  buildExtractionBatches,
  callOllamaGenerate,
  generateDraftKnowledgePack,
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
    await assertOllamaTimeoutReturnsUsefulError();
    await assertValidMockCreatesDraft();
    await assertMultiChunkUploadMergesBatchDrafts();
    await assertLargePdfSplitsIntoPageChunksAndBatches();
    await assertPreviewModeProcessesOnlyFirstPagesAndWritesNoDraft();
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
  assert.ok(prompt.includes('Formulas may be included only as referenceFormulas.'));
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
  } finally {
    restoreHttpRequest();
  }
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
  assert.ok(result.fullImportEstimate.characterCount > result.previewReport.processedCharacterCount);
  assert.equal(fs.existsSync(outputDraftDir), false, 'preview mode should not write a final draft pack.');
  assert.ok(prompts.some((prompt) => prompt.includes('Page 1')));
  assert.ok(prompts.every((prompt) => !prompt.includes('Page 4')));
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
  assert.equal(result.importSelection.completePacketImported, false);
  assert.ok(result.selectedImportEstimate.characterCount < result.fullImportEstimate.characterCount);
  assert.ok(result.timeline.some((event) => event.type === 'import_selection_ready'));
  assert.ok(prompts.length >= 1);

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.metadata.partialImport.importedPages, [2, 3, 4]);
  assert.equal(generated.metadata.partialImport.completePacketImported, false);
  assert.equal(generated.metadata.partialImport.originalPageCount, 6);
  assert.equal(generated.metadata.importSelection.label, 'Pages 2-4');
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
  assert.deepEqual(generated.referenceFormulas, []);
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

async function assertRequiredFactFieldsAreStillRejected() {
  const outputDraftDir = path.join(tempRoot, 'missing-facts-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-missing-facts-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: ''
        }
      ],
      concepts: [
        {
          ...makeConceptItem(),
          title: ''
        }
      ]
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('vocabulary[0].term must be a non-empty string.')));
  assert.ok(result.errors.some((error) => error.includes('concepts[0].title must be a non-empty string.')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  const debug = JSON.parse(fs.readFileSync(result.rawModelResponsePath, 'utf8'));
  assert.equal(debug.normalizedDraftAttempt.vocabulary[0].term, '');
  assert.equal(debug.normalizedDraftAttempt.concepts[0].title, '');
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
