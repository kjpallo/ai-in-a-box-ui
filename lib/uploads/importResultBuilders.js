const fs = require('node:fs');
const path = require('node:path');

const { SAFE_PACK_ID_PATTERN } = require('../knowledge/packSchema');
const { validateStandardsBank } = require('../standards/validateStandardsBank');
const {
  DEFAULT_RAW_MODEL_RESPONSES_DIR,
  GENERATED_ITEM_SECTIONS
} = require('./importConstants');
const {
  mergeDraftKnowledgePacks,
  normalizedSourceFileNames
} = require('./draftPackNormalizer');
const { previewMaxCharacters, previewModeLabel } = require('./importSafety');

function makePreviewResult({
  partial,
  partialReason,
  pack,
  generatedBatches,
  extraction,
  importEstimate,
  selectedImportEstimate,
  inputSnapshot,
  importSelection,
  importScope,
  coverageReport,
  timeline,
  warnings,
  errors,
  validationErrors,
  invalidItems,
  repairNeeded,
  rawModelResponsePath,
  failedBatches,
  model,
  options
}) {
  const safeOptions = options || {};
  const safeGeneratedBatches = Array.isArray(generatedBatches) ? generatedBatches : [];
  const previewPack = pack || (safeGeneratedBatches.length === 1
      ? safeGeneratedBatches[0].pack
      : mergeDraftKnowledgePacks(safeGeneratedBatches.map((entry) => entry.pack), {
        extraction,
        packName: safeOptions.packName,
        importProfile: normalizeImportProfile(safeOptions.importProfile)
      }));
  previewPack.metadata = {
    ...(previewPack.metadata || {}),
    importCoverage: coverageReport,
    importScope,
    partialPreview: partial === true,
    validationPassed: partial ? false : true
  };
  if (partialReason) previewPack.metadata.partialPreviewReason = partialReason;
  if (Array.isArray(invalidItems) && invalidItems.length) previewPack.metadata.invalidPreviewItemCount = invalidItems.length;
  if (importSelection) previewPack.metadata.importSelection = importSelection;
  const packId = previewPack.packId;
  const previewMessage = partialReason === 'validation'
    ? 'Partial preview created. Validation found repair-needed items; valid preview items were kept.'
    : partial
      ? 'Partial preview created. Some pages/chunks failed.'
      : 'Preview draft prepared. Review the sample before running full import.';
  return {
    success: true,
    preview: true,
    partialPreview: partial === true,
    validationPassed: partial ? false : true,
    packId,
    title: previewPack.title || packId,
    sourceFiles: normalizedSourceFileNames(previewPack),
    extractionCharacterCount: String(extraction.text || '').length,
    extractionChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0,
    extractionPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    fullImportEstimate: importEstimate,
    selectedImportEstimate,
    inputSnapshot,
    importScope,
    importSelection,
    previewReport: {
      pack: previewPack,
      partialPreview: partial === true,
      partialPreviewReason: partialReason || '',
      validationPassed: partial ? false : true,
      message: previewMessage,
      model,
      previewMode: previewModeLabel(safeOptions),
      maxPreviewChars: previewMaxCharacters(safeOptions),
      coverageReport,
      failedBatches: failedBatches || [],
      errors: errors || [],
      validationErrors: validationErrors || errors || [],
      invalidItems: invalidItems || [],
      repairNeeded: repairNeeded || invalidItems || [],
      rawModelResponsePath,
      warnings: warnings || [],
      inputSnapshot,
      importScope,
      deduplication: previewPack.metadata && previewPack.metadata.deduplication,
      importNormalization: previewPack.metadata && previewPack.metadata.importNormalization,
      processedPageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
      processedCharacterCount: String(extraction.text || '').length,
      processedChunkCount: Array.isArray(extraction.sections) ? extraction.sections.length : 0
    },
    coverageReport,
    importSelection,
    timeline,
    warnings: warnings || [],
    errors: errors || [],
    validationErrors: validationErrors || errors || [],
    invalidItems: invalidItems || [],
    repairNeeded: repairNeeded || invalidItems || [],
    rawModelResponsePath,
    failedBatches: failedBatches || []
  };
}

function validateDraftSafety(pack) {
  const errors = [];

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return ['Generated draft must be a JSON object.'];
  }

  if (typeof pack.packId === 'string' && !SAFE_PACK_ID_PATTERN.test(pack.packId)) {
    errors.push('Generated packId must be safe for filenames before writing a draft.');
  }

  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    const items = pack[sectionName];
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      if (item.reviewStatus === 'approved' || item.reviewStatus === 'rejected') {
        errors.push(`${sectionName}[${index}].reviewStatus must not be "approved" or "rejected" for generated drafts.`);
      } else if (!['pending', 'needs_review'].includes(item.reviewStatus)) {
        errors.push(`${sectionName}[${index}].reviewStatus must be "pending" or "needs_review" for generated drafts.`);
      }
      if (sectionName === 'referenceFormulas' && item.solverStatus !== 'reference_only') {
        errors.push(`${sectionName}[${index}].solverStatus must be "reference_only" for uploaded formulas.`);
      }
    });
  });

  return errors;
}

function loadStandardsBank(standardsBankInput) {
  if (!standardsBankInput) {
    return {
      success: true,
      standardsBank: null,
      warnings: [],
      errors: []
    };
  }

  let standardsBank = standardsBankInput;
  if (typeof standardsBankInput === 'string') {
    const readResult = readJsonFile(path.resolve(standardsBankInput), 'standards bank');
    if (!readResult.success) return { ...readResult, standardsBank: null, warnings: [] };
    standardsBank = readResult.value;
  }

  if (!standardsBank || typeof standardsBank !== 'object' || Array.isArray(standardsBank)) {
    return {
      success: false,
      standardsBank: null,
      warnings: [],
      errors: ['standardsBank must be a standards bank object or a path to standards_bank.json.']
    };
  }

  const validation = validateStandardsBank(standardsBank);
  if (!validation.valid) {
    return {
      success: false,
      standardsBank: null,
      warnings: validation.warnings,
      errors: validation.errors.map((error) => `Standards bank validation failed: ${error}`)
    };
  }

  return {
    success: true,
    standardsBank,
    warnings: validation.warnings,
    errors: []
  };
}

function validateExtraction(extraction) {
  const errors = [];

  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    return ['Extraction JSON must be an object.'];
  }

  if (extraction.success !== true) {
    errors.push('Extraction JSON must have success: true before draft generation.');
  }

  if (typeof extraction.text !== 'string' || extraction.text.trim().length === 0) {
    errors.push('Extraction JSON must include non-empty text.');
  }

  if (typeof extraction.fileName !== 'string' || extraction.fileName.trim().length === 0) {
    errors.push('Extraction JSON must include fileName.');
  }

  return errors;
}

function readJsonFile(filePath, label) {
  try {
    return {
      success: true,
      value: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Could not read or parse ${label}: ${error.message}`]
    };
  }
}

function writeRawResponse(options, rawModelResponse) {
  const outputPath = options.rawModelResponsePath
    ? path.resolve(options.rawModelResponsePath)
    : makeRawResponsePath(options.rawModelResponsesDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, String(rawModelResponse || ''), 'utf8');
  return outputPath;
}

function makeRawResponsePath(rawModelResponsesDir) {
  const outputDir = path.resolve(rawModelResponsesDir || DEFAULT_RAW_MODEL_RESPONSES_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(16).slice(2, 10);
  return path.join(outputDir, `model-response-${timestamp}-${suffix}.txt`);
}

function blocked(result) {
  return {
    success: false,
    packId: result.packId,
    outputPath: result.outputPath,
    validationPassed: result.validationPassed === true ? true : false,
    warnings: result.warnings || [],
    errors: result.errors || [],
    rawModelResponsePath: result.rawModelResponsePath,
    timeline: result.timeline || [],
    coverageReport: result.coverageReport,
    validationErrors: result.validationErrors || [],
    invalidItems: result.invalidItems || [],
    repairNeeded: result.repairNeeded || [],
    importSelection: result.importSelection,
    importScope: result.importScope,
    selectedImportEstimate: result.selectedImportEstimate,
    failedBatches: result.failedBatches || [],
    modelCrash: result.modelCrash === true,
    modelTimeout: result.modelTimeout === true,
    modelUnavailable: result.modelUnavailable === true
  };
}


module.exports = {
  makePreviewResult,
  validateDraftSafety,
  loadStandardsBank,
  validateExtraction,
  readJsonFile,
  writeRawResponse,
  makeRawResponsePath,
  blocked
};
