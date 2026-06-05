const crypto = require('node:crypto');

const {
  DEFAULT_MODEL,
  DEFAULT_MODEL_SEED,
  DEFAULT_MODEL_TEMPERATURE,
  DEFAULT_MODEL_TOP_P,
  DEFAULT_MODEL_TOP_K,
  DEFAULT_BATCH_MAX_CHARACTERS,
  DEFAULT_RETRY_BATCH_MAX_CHARACTERS,
  DEFAULT_PREVIEW_MAX_PAGES,
  DEFAULT_PREVIEW_MAX_CHARACTERS,
  DEFAULT_FULL_REQUIRES_CONFIRMATION,
  DEFAULT_LARGE_IMPORT_CHARACTERS,
  DEFAULT_LARGE_IMPORT_PAGES,
  DEFAULT_LARGE_IMPORT_BATCHES,
  DEFAULT_HARD_STOP_CHARACTERS,
  DEFAULT_HARD_STOP_PAGES,
  DEFAULT_HARD_STOP_BATCHES,
  PROMPT_VERSION
} = require('./importConstants');
const { firstNonEmptyString } = require('./importTextUtils');

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function modelMaxCharacters(options = {}) {
  if (options.previewOnly === true || options.importMode === 'preview') {
    return previewMaxCharacters(options);
  }
  return positiveInteger(options.maxBatchCharacters || process.env.IMPORT_MODEL_MAX_CHARS, DEFAULT_BATCH_MAX_CHARACTERS);
}

function modelRetryMaxCharacters(options = {}) {
  const configured = positiveInteger(options.retryMaxBatchCharacters || options.retryMaxCharacters || process.env.IMPORT_MODEL_RETRY_MAX_CHARS, DEFAULT_RETRY_BATCH_MAX_CHARACTERS);
  return Math.min(configured, Math.max(1, Math.floor(modelMaxCharacters(options) / 2)));
}

function previewMaxPages(options = {}) {
  return positiveInteger(options.previewMaxPages || process.env.IMPORT_PREVIEW_MAX_PAGES, DEFAULT_PREVIEW_MAX_PAGES);
}

function previewMaxCharacters(options = {}) {
  return positiveInteger(options.previewMaxCharacters || process.env.IMPORT_PREVIEW_MAX_CHARS, DEFAULT_PREVIEW_MAX_CHARACTERS);
}

function isUltraSafePreview(options = {}) {
  const mode = String(options.previewMode || options.previewSize || '').trim().toLowerCase();
  return mode === 'ultra-safe' || mode === 'ultrasafe' || mode === 'ultra_safe';
}

function previewModeLabel(options = {}) {
  if (isUltraSafePreview(options)) return 'Ultra-safe';
  const mode = String(options.previewMode || options.previewSize || '').trim().toLowerCase();
  if (mode === 'custom') return 'Custom';
  return 'Normal';
}

function fullImportRequiresConfirmation(options = {}) {
  const value = options.fullImportRequiresConfirmation ?? process.env.IMPORT_FULL_REQUIRES_CONFIRMATION;
  if (value === undefined || value === null || value === '') return DEFAULT_FULL_REQUIRES_CONFIRMATION;
  return !['false', '0', 'no'].includes(String(value).trim().toLowerCase());
}

function makeDeterministicModelOptions(options = {}) {
  const modelOptions = {
    temperature: numberOrDefault(options.temperature ?? process.env.IMPORT_MODEL_TEMPERATURE, DEFAULT_MODEL_TEMPERATURE),
    seed: positiveInteger(options.seed ?? process.env.IMPORT_MODEL_SEED, DEFAULT_MODEL_SEED),
    top_p: numberOrDefault(options.topP ?? options.top_p ?? process.env.IMPORT_MODEL_TOP_P, DEFAULT_MODEL_TOP_P),
    top_k: positiveInteger(options.topK ?? options.top_k ?? process.env.IMPORT_MODEL_TOP_K, DEFAULT_MODEL_TOP_K)
  };
  const numCtx = positiveIntegerOrUndefined(
    options.numCtx
    ?? options.num_ctx
    ?? process.env.OLLAMA_IMPORT_NUM_CTX
    ?? process.env.IMPORT_MODEL_NUM_CTX
  );
  const numPredict = positiveIntegerOrUndefined(
    options.numPredict
    ?? options.num_predict
    ?? process.env.OLLAMA_IMPORT_NUM_PREDICT
    ?? process.env.IMPORT_MODEL_NUM_PREDICT
  );
  if (numCtx) modelOptions.num_ctx = numCtx;
  if (numPredict) modelOptions.num_predict = numPredict;
  return modelOptions;
}

function resolveImportModel(options = {}) {
  return firstNonEmptyString(
    options.model,
    process.env.OLLAMA_IMPORT_MODEL,
    process.env.OLLAMA_MODEL,
    DEFAULT_MODEL
  );
}

function positiveIntegerOrUndefined(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildImportInputSnapshot({ uploadId, importSelection, importScope, model, modelSettings, sourceChunks }) {
  const chunks = (Array.isArray(sourceChunks) ? sourceChunks : []).map((chunk) => ({
    index: Number(chunk.index || chunk.chunkIndex || 0),
    label: String(chunk.label || chunk.sourceLocation || ''),
    pageNumber: Number(chunk.pageNumber || chunk.page || 0),
    hash: hashText(chunk.text || '')
  }));
  return {
    uploadId: String(uploadId || ''),
    promptVersion: PROMPT_VERSION,
    model,
    modelSettings,
    importSelection: importSelection || null,
    importScope: importScope || null,
    chunkTextHashes: chunks
  };
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function importSafetyThresholds(options = {}) {
  return {
    largeCharacterCount: positiveInteger(options.largeImportCharacterCount || process.env.IMPORT_LARGE_CHAR_LIMIT, DEFAULT_LARGE_IMPORT_CHARACTERS),
    largePageCount: positiveInteger(options.largeImportPageCount || process.env.IMPORT_LARGE_PAGE_LIMIT, DEFAULT_LARGE_IMPORT_PAGES),
    largeBatchCount: positiveInteger(options.largeImportBatchCount || process.env.IMPORT_LARGE_BATCH_LIMIT, DEFAULT_LARGE_IMPORT_BATCHES),
    hardStopCharacterCount: positiveInteger(options.hardStopCharacterCount || process.env.IMPORT_HARD_STOP_CHAR_LIMIT, DEFAULT_HARD_STOP_CHARACTERS),
    hardStopPageCount: positiveInteger(options.hardStopPageCount || process.env.IMPORT_HARD_STOP_PAGE_LIMIT, DEFAULT_HARD_STOP_PAGES),
    hardStopBatchCount: positiveInteger(options.hardStopBatchCount || process.env.IMPORT_HARD_STOP_BATCH_LIMIT, DEFAULT_HARD_STOP_BATCHES)
  };
}

function estimatePageCount(extraction) {
  const explicit = Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const pages = Array.isArray(extraction && extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction && extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  return pages.length;
}


module.exports = {
  positiveInteger,
  modelMaxCharacters,
  modelRetryMaxCharacters,
  previewMaxPages,
  previewMaxCharacters,
  isUltraSafePreview,
  previewModeLabel,
  fullImportRequiresConfirmation,
  makeDeterministicModelOptions,
  resolveImportModel,
  positiveIntegerOrUndefined,
  numberOrDefault,
  buildImportInputSnapshot,
  hashText,
  importSafetyThresholds,
  estimatePageCount
};
