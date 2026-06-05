const http = require('node:http');

const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');
const {
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_OLLAMA_KEEP_ALIVE,
  DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
  MODEL_GENERATION_TIMEOUT_CODE,
  MODEL_GENERATION_TIMEOUT_MESSAGE
} = require('./importConstants');
const {
  makeDeterministicModelOptions,
  modelRetryMaxCharacters,
  previewMaxCharacters,
  positiveInteger
} = require('./importSafety');
const { parseModelResponse, buildJsonRepairPrompt } = require('./modelResponseParser');
const { writeRawResponse } = require('./importResultBuilders');
const {
  buildRetryBatchesForBatch,
  splitLongText,
  makeBatchExtraction
} = require('./extractionBatching');
const {
  normalizeDraftKnowledgePack,
  mergeDraftKnowledgePacks,
  normalizeImportProfile,
  countGeneratedItems,
  makeSourceTextSnippet
} = require('./draftPackNormalizer');

async function generateBatchDraft({
  batch,
  model,
  prompt,
  modelClient,
  timeoutMs,
  keepAlive,
  retryInvalidJson,
  options
}) {
  let rawModelResponse;
  try {
    rawModelResponse = await callModelClientWithTimeout(modelClient, {
      model,
      prompt,
      timeoutMs,
      keepAlive,
      options: makeDeterministicModelOptions(options)
    }, timeoutMs);
  } catch (error) {
    const modelTimeout = isModelTimeoutError(error);
    const modelUnavailable = isModelUnavailableError(error);
    const errors = modelTimeout
      ? makeModelTimeoutBatchErrors(
        batch,
        batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches,
        [error.message],
        { model, previewMaxCharacters: previewMaxCharacters(options), previewOnly: options.previewOnly === true || options.importMode === 'preview' }
      )
      : makeModelBatchErrors(
        batch,
        batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches,
        [error.message],
        false,
        { model, previewMaxCharacters: previewMaxCharacters(options), previewOnly: options.previewOnly === true || options.importMode === 'preview' }
      );
    return {
      success: false,
      rawModelResponse,
      modelCrash: modelTimeout || isModelCrashError(error),
      modelTimeout,
      modelUnavailable,
      errors,
      failedBatches: [makeFailedBatchWarning(batch, errors)]
    };
  }

  let parsedResult = parseModelResponse(rawModelResponse);
  if (!parsedResult.success && retryInvalidJson) {
    let retryRawModelResponse;
    try {
      retryRawModelResponse = await callModelClientWithTimeout(modelClient, {
        model,
        prompt: buildJsonRepairPrompt(rawModelResponse),
        timeoutMs,
        keepAlive,
        options: makeDeterministicModelOptions(options)
      }, timeoutMs);
    } catch (error) {
      const errors = [
        ...parsedResult.errors,
        `Ollama JSON repair retry failed for batch ${batch.batchIndex}: ${error.message}`
      ];
      return {
        success: false,
        rawModelResponse,
        errors,
        modelCrash: isModelCrashError(error),
        modelTimeout: isModelTimeoutError(error),
        modelUnavailable: isModelUnavailableError(error),
        rawModelResponsePath: writeRawResponse(options, rawModelResponse),
        failedBatches: [makeFailedBatchWarning(batch, errors)]
      };
    }

    const retryParsedResult = parseModelResponse(retryRawModelResponse);
    if (retryParsedResult.success) {
      parsedResult = retryParsedResult;
      rawModelResponse = retryRawModelResponse;
    } else {
      const errors = [
        ...parsedResult.errors,
        `JSON repair retry also failed for batch ${batch.batchIndex}: ${retryParsedResult.errors.join('; ')}`
      ];
      return {
        success: false,
        rawModelResponse: retryRawModelResponse,
        errors,
        rawModelResponsePath: writeRawResponse(options, retryRawModelResponse),
        failedBatches: [makeFailedBatchWarning(batch, errors)]
      };
    }
  }

  if (!parsedResult.success) {
    return {
      success: false,
      rawModelResponse,
      errors: parsedResult.errors,
      rawModelResponsePath: writeRawResponse(options, rawModelResponse),
      failedBatches: [makeFailedBatchWarning(batch, parsedResult.errors)]
    };
  }

  return {
    success: true,
    rawModelResponse,
    parsedModelResponse: parsedResult.value
  };
}

async function retryBatchWithSmallerChunks({
  originalBatch,
  retryBatches,
  totalBatches,
  standardsBank,
  packName,
  model,
  modelClient,
  timeoutMs,
  keepAlive,
  retryInvalidJson,
  options,
  importScope,
  recordProgress
}) {
  const parsedModelResponses = [];
  const rawModelResponses = [];
  const packs = [];

  for (const retryBatch of retryBatches) {
    const prompt = buildKnowledgePackPrompt({
      extraction: retryBatch.extraction,
      standardsBank,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
      batchInfo: {
        batchIndex: originalBatch.batchIndex,
        totalBatches
      }
    });
    recordProgress('batch_retry_sent', `Retrying batch ${originalBatch.batchIndex} with smaller chunk ${retryBatch.retryIndex} of ${retryBatches.length}`, {
      batchIndex: originalBatch.batchIndex,
      totalBatches,
      retryIndex: retryBatch.retryIndex,
      retryTotal: retryBatches.length,
      characterCount: String(retryBatch.extraction.text || '').length,
      chunkCount: retryBatch.chunks.length,
      chunkLabels: retryBatch.chunks.map((chunk) => chunk.label)
    });

    const retryResult = await generateBatchDraft({
      batch: retryBatch,
      model,
      prompt,
      modelClient,
      timeoutMs,
      keepAlive,
      retryInvalidJson,
      options
    });
    rawModelResponses.push(...normalizeRawResponses(retryResult.rawModelResponse));
    if (!retryResult.success) {
      const retryErrors = retryResult.modelCrash === true || retryResult.modelTimeout === true
        ? makeModelBatchErrors(originalBatch, totalBatches, retryResult.errors, true, {
          model,
          previewMaxCharacters: previewMaxCharacters(options),
          previewOnly: options.previewOnly === true || options.importMode === 'preview'
        })
        : retryResult.errors;
      const failedBatch = makeFailedBatchWarning(retryBatch, retryErrors);
      return {
        ...retryResult,
        rawModelResponse: rawModelResponses,
        errors: retryErrors,
        failedBatches: [failedBatch]
      };
    }

    parsedModelResponses.push(retryResult.parsedModelResponse);
    packs.push(normalizeDraftKnowledgePack(retryResult.parsedModelResponse, {
      extraction: retryBatch.extraction,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
      importScope
    }));
    recordProgress('batch_retry_received', `Received retry draft items for batch ${originalBatch.batchIndex}, smaller chunk ${retryBatch.retryIndex} of ${retryBatches.length}`, {
      batchIndex: originalBatch.batchIndex,
      totalBatches,
      retryIndex: retryBatch.retryIndex,
      retryTotal: retryBatches.length,
      itemCounts: countGeneratedItems(packs[packs.length - 1])
    });
  }

  const merged = packs.length === 1
    ? packs[0]
    : mergeDraftKnowledgePacks(packs, {
      extraction: originalBatch.extraction,
      packName,
      importProfile: normalizeImportProfile(options.importProfile),
      importScope
    });

  return {
    success: true,
    rawModelResponse: rawModelResponses,
    parsedModelResponse: merged,
    retrySucceeded: true,
    retryBatches
  };
}

function shouldRetryModelCrash(result) {
  return Boolean(result && !result.modelTimeout && (result.modelCrash || (result.errors || []).some((error) => isModelCrashMessage(error))));
}

function isModelCrashError(error) {
  return isModelCrashMessage(error && error.message);
}

function isModelTimeoutError(error) {
  return Boolean(error && (error.code === MODEL_GENERATION_TIMEOUT_CODE || isModelTimeoutMessage(error.message)));
}

function isModelUnavailableError(error) {
  return isModelUnavailableMessage(error && error.message);
}

function isModelCrashMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('ollama returned http 500')
    || message.includes('ggml_assert')
    || message.includes('signal arrived during cgo execution')
    || message.includes('llama runner process has terminated')
    || message.includes('model runner has unexpectedly stopped')
    || message.includes('resource limitations')
    || message.includes('internal error');
}

function isModelTimeoutMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('local gemma took too long while reading this batch')
    || message.includes('ollama request timed out')
    || message.includes('request timed out')
    || message.includes('timed out')
    || message.includes('timeout');
}

function isModelUnavailableMessage(value) {
  const message = String(value || '').toLowerCase();
  return message.includes('econnrefused')
    || message.includes('connect refused')
    || message.includes('connection refused')
    || message.includes('ollama is not running')
    || message.includes('could not connect to ollama')
    || message.includes('failed to fetch')
    || message.includes('fetch failed');
}

function makeModelBatchErrors(batch, totalBatches, underlyingErrors = [], afterRetry = false, context = {}) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const retryText = afterRetry
    ? 'Retry failed after a smaller batch.'
    : 'Retrying once with a smaller batch.';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  const previewLimitText = context.previewOnly ? ` Current preview character limit: ${previewMaxCharacters({ previewMaxCharacters: context.previewMaxCharacters })}.` : '';
  const modelText = context.model ? ` Current model: ${context.model}.` : '';
  return [
    `Local Gemma crashed while reading batch ${batchIndex} of ${total}. ${retryText}${pageLabels}`,
    [modelText.trim(), previewLimitText.trim()].filter(Boolean).join(' '),
    original ? `Ollama detail for batch ${batchIndex}: ${original}` : ''
  ].filter(Boolean);
}

function makeModelTimeoutBatchErrors(batch, totalBatches, underlyingErrors = [], context = {}) {
  const batchIndex = batch && batch.batchIndex || 1;
  const total = Number(totalBatches || batch && batch.extraction && batch.extraction.metadata && batch.extraction.metadata.importBatch && batch.extraction.metadata.importBatch.totalBatches || 1);
  const labels = Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [];
  const pageLabels = labels.length ? ` Affected source chunks/pages: ${labels.join(', ')}.` : '';
  const original = underlyingErrors.map((error) => String(error || '').trim()).filter(Boolean).join('; ');
  const previewLimitText = context.previewOnly ? ` Current preview character limit: ${previewMaxCharacters({ previewMaxCharacters: context.previewMaxCharacters })}.` : '';
  const modelText = context.model ? ` Current model: ${context.model}.` : '';
  return [
    MODEL_GENERATION_TIMEOUT_MESSAGE,
    `Gemma timed out while reading batch ${batchIndex} of ${total}.${pageLabels}`,
    [modelText.trim(), previewLimitText.trim()].filter(Boolean).join(' '),
    original && original !== MODEL_GENERATION_TIMEOUT_MESSAGE ? `Ollama detail for batch ${batchIndex}: ${original}` : ''
  ].filter(Boolean);
}

function makeFailedBatchWarning(batch, errors = []) {
  return {
    batchIndex: batch && batch.batchIndex || 1,
    retryIndex: batch && batch.retryIndex,
    chunkLabels: Array.isArray(batch && batch.chunks) ? batch.chunks.map((chunk) => chunk.label).filter(Boolean) : [],
    pages: Array.from(new Set((Array.isArray(batch && batch.chunks) ? batch.chunks : [])
      .map((chunk) => Number(chunk.pageNumber || chunk.page || 0))
      .filter((page) => Number.isFinite(page) && page > 0))),
    characterCount: String(batch && batch.extraction && batch.extraction.text || '').length,
    errors: Array.isArray(errors) ? errors : [String(errors || '')]
  };
}

function normalizeRawResponses(rawModelResponse) {
  if (rawModelResponse === undefined || rawModelResponse === null) return [];
  return Array.isArray(rawModelResponse) ? rawModelResponse : [rawModelResponse];
}

function callModelClientWithTimeout(modelClient, request, timeoutMs) {
  const ms = Number(timeoutMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) {
    return modelClient(request);
  }

  let timeoutId;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(MODEL_GENERATION_TIMEOUT_MESSAGE);
      error.code = MODEL_GENERATION_TIMEOUT_CODE;
      reject(error);
    }, ms);
  });

  return Promise.race([
    Promise.resolve().then(() => modelClient(request)),
    timeoutPromise
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function callOllamaGenerate({
  model,
  prompt,
  ollamaUrl = DEFAULT_OLLAMA_URL,
  timeoutMs = DEFAULT_OLLAMA_TIMEOUT_MS,
  keepAlive = DEFAULT_OLLAMA_KEEP_ALIVE,
  options = {}
}) {
  const url = new URL(ollamaUrl);
  if (!isLocalhost(url.hostname)) {
    throw new Error(`Refusing to call non-local Ollama host: ${url.hostname}`);
  }

  const responseText = await postJson(url, {
    model,
    prompt,
    stream: false,
    format: 'json',
    keep_alive: keepAlive,
    options: {
      ...makeDeterministicModelOptions(options),
      ...(options && typeof options === 'object' ? options : {})
    }
  }, { timeoutMs });
  const parsed = JSON.parse(responseText);
  if (typeof parsed.response !== 'string') {
    throw new Error('Ollama response did not include a response string.');
  }
  return parsed.response;
}

function postJson(url, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(options.timeoutMs || DEFAULT_OLLAMA_TIMEOUT_MS);
    const body = JSON.stringify(payload);
    const request = http.request({
      hostname: url.hostname,
      port: url.port || 80,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Ollama returned HTTP ${response.statusCode}: ${data}`));
          return;
        }
        resolve(data);
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Ollama request timed out. This can happen when the model is cold-loading. Try again, warm the model with `ollama run gemma4:e2b`, or increase --timeout-ms.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function isLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}


module.exports = {
  generateBatchDraft,
  retryBatchWithSmallerChunks,
  shouldRetryModelCrash,
  isModelCrashError,
  isModelTimeoutError,
  isModelUnavailableError,
  isModelCrashMessage,
  isModelTimeoutMessage,
  isModelUnavailableMessage,
  makeModelBatchErrors,
  makeModelTimeoutBatchErrors,
  makeFailedBatchWarning,
  normalizeRawResponses,
  callModelClientWithTimeout,
  callOllamaGenerate,
  postJson,
  isLocalhost
};
