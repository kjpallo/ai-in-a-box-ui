const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const { DEFAULT_DRAFT_PACKS_DIR } = require('../knowledge/loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('../knowledge/packSchema');
const { validateKnowledgePack } = require('../knowledge/validateKnowledgePack');
const { validateStandardsBank } = require('../standards/validateStandardsBank');
const { buildKnowledgePackPrompt } = require('./buildKnowledgePackPrompt');

const DEFAULT_MODEL = 'gemma4:e2b';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_RAW_MODEL_RESPONSES_DIR = path.join(__dirname, '..', '..', 'tmp', 'model-responses');
const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const DEFAULT_DRAFT_VERSION = '0.1.0-draft';
const GENERATED_ITEM_SECTIONS = [
  'sourceFiles',
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

async function generateDraftKnowledgePack(options = {}) {
  const warnings = [];
  const errors = [];
  const extractionJsonPath = options.extractionJsonPath || options.input;
  const outputDraftDir = path.resolve(options.outputDraftDir || options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const model = options.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const modelClient = options.modelClient || callOllamaGenerate;
  const retryInvalidJson = options.retryInvalidJson === true;
  const force = options.force === true;

  if (!extractionJsonPath || typeof extractionJsonPath !== 'string') {
    return blocked({ warnings, errors: ['An extraction JSON path is required.'] });
  }

  const extractionResult = readJsonFile(path.resolve(extractionJsonPath), 'extraction JSON');
  if (!extractionResult.success) {
    return blocked({ warnings, errors: extractionResult.errors });
  }

  const extraction = extractionResult.value;
  const extractionValidationErrors = validateExtraction(extraction);
  if (extractionValidationErrors.length > 0) {
    return blocked({ warnings, errors: extractionValidationErrors });
  }

  const standardsResult = loadStandardsBank(options.standardsBankPath || options.standardsBank);
  warnings.push(...standardsResult.warnings);
  if (!standardsResult.success) {
    return blocked({ warnings, errors: standardsResult.errors });
  }

  const prompt = buildKnowledgePackPrompt({
    extraction,
    standardsBank: standardsResult.standardsBank
  });

  let rawModelResponse;
  try {
    rawModelResponse = await modelClient({ model, prompt });
  } catch (error) {
    return blocked({ warnings, errors: [`Ollama draft generation failed: ${error.message}`] });
  }

  let parsedResult = parseModelResponse(rawModelResponse);
  if (!parsedResult.success && retryInvalidJson) {
    let retryRawModelResponse;
    try {
      retryRawModelResponse = await modelClient({
        model,
        prompt: buildJsonRepairPrompt(rawModelResponse)
      });
    } catch (error) {
      return blocked({
        warnings,
        errors: [
          ...parsedResult.errors,
          `Ollama JSON repair retry failed: ${error.message}`
        ],
        rawModelResponsePath: writeRawResponse(options, rawModelResponse)
      });
    }

    const retryParsedResult = parseModelResponse(retryRawModelResponse);
    if (retryParsedResult.success) {
      parsedResult = retryParsedResult;
      rawModelResponse = retryRawModelResponse;
    } else {
      return blocked({
        warnings,
        errors: [
          ...parsedResult.errors,
          `JSON repair retry also failed: ${retryParsedResult.errors.join('; ')}`
        ],
        rawModelResponsePath: writeRawResponse(options, retryRawModelResponse)
      });
    }
  }

  if (!parsedResult.success) {
    return blocked({
      warnings,
      errors: parsedResult.errors,
      rawModelResponsePath: writeRawResponse(options, rawModelResponse)
    });
  }

  const pack = normalizeDraftKnowledgePack(parsedResult.value, { extraction });
  const draftSafetyErrors = validateDraftSafety(pack);
  const validation = validateKnowledgePack(pack, {
    standardsBank: standardsResult.standardsBank
  });
  warnings.push(...validation.warnings);

  if (draftSafetyErrors.length > 0 || !validation.valid) {
    return blocked({
      packId: pack && pack.packId,
      warnings,
      errors: [...draftSafetyErrors, ...validation.errors],
      validationPassed: false,
      rawModelResponsePath: writeRawResponse(options, JSON.stringify({
        rawModelResponse,
        parsedModelResponse: parsedResult.value,
        normalizedDraftAttempt: pack,
        errors: [...draftSafetyErrors, ...validation.errors]
      }, null, 2))
    });
  }

  const safePackId = pack.packId;
  const outputDir = path.join(outputDraftDir, safePackId);
  const outputPath = path.join(outputDir, KNOWLEDGE_PACK_FILE_NAME);

  if (fs.existsSync(outputPath) && !force) {
    return blocked({
      packId: safePackId,
      outputPath,
      warnings,
      errors: [`Draft pack already exists at ${outputPath}. Pass force: true to overwrite.`],
      validationPassed: true
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);

  return {
    success: true,
    packId: safePackId,
    outputPath,
    validationPassed: true,
    warnings,
    errors: []
  };
}

async function callOllamaGenerate({ model, prompt, ollamaUrl = DEFAULT_OLLAMA_URL }) {
  const url = new URL(ollamaUrl);
  if (!isLocalhost(url.hostname)) {
    throw new Error(`Refusing to call non-local Ollama host: ${url.hostname}`);
  }

  const responseText = await postJson(url, {
    model,
    prompt,
    stream: false,
    format: 'json'
  });
  const parsed = JSON.parse(responseText);
  if (typeof parsed.response !== 'string') {
    throw new Error('Ollama response did not include a response string.');
  }
  return parsed.response;
}

function postJson(url, payload) {
  return new Promise((resolve, reject) => {
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
      timeout: 120000
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
      request.destroy(new Error('Ollama request timed out.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function parseModelResponse(rawModelResponse) {
  const raw = typeof rawModelResponse === 'string'
    ? rawModelResponse
    : rawModelResponse && typeof rawModelResponse.response === 'string'
      ? rawModelResponse.response
      : JSON.stringify(rawModelResponse);
  const cleanedResult = normalizeJsonResponse(raw || '');

  if (!cleanedResult.success) {
    return {
      success: false,
      errors: cleanedResult.errors.map((error) => `Model response was not valid JSON: ${error}`)
    };
  }

  try {
    return {
      success: true,
      value: JSON.parse(cleanedResult.value)
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Model response was not valid JSON: ${error.message}`]
    };
  }
}

function normalizeJsonResponse(value) {
  const trimmed = stripJsonFence(String(value || '')).trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      errors: ['Model response was empty and not valid JSON.']
    };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return {
      success: true,
      value: trimmed
    };
  }

  const extracted = extractSingleJsonObject(trimmed);
  if (!extracted.success) {
    return extracted;
  }

  return {
    success: true,
    value: extracted.value
  };
}

function stripJsonFence(value) {
  const trimmed = String(value || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function extractSingleJsonObject(value) {
  const matches = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        return {
          success: false,
          errors: ['Model response included an unmatched closing brace and was not valid JSON.']
        };
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        matches.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  if (depth !== 0 || inString) {
    return {
      success: false,
      errors: ['Model response did not contain a complete JSON object.']
    };
  }

  if (matches.length !== 1) {
    return {
      success: false,
      errors: [`Model response must contain exactly one JSON object; found ${matches.length}.`]
    };
  }

  return {
    success: true,
    value: matches[0]
  };
}

function buildJsonRepairPrompt(rawModelResponse) {
  return [
    'Convert the following attempted response into valid JSON matching the required schema.',
    'Return JSON only. Do not add new facts.',
    '',
    'Attempted response:',
    String(rawModelResponse || '')
  ].join('\n');
}

function normalizeDraftKnowledgePack(pack, options = {}) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return pack;

  const normalized = { ...pack };
  const sourceDefaults = makeSourceDefaults(options.extraction);

  if (typeof normalized.version !== 'string' || normalized.version.trim().length === 0) {
    normalized.version = DEFAULT_DRAFT_VERSION;
  }

  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    if (!Array.isArray(normalized[sectionName])) {
      normalized[sectionName] = [];
    }
  });

  if (!normalized.metadata || typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
    normalized.metadata = {};
  }

  normalized.sourceFiles = normalizeSourceFiles(normalized.sourceFiles, options.extraction, sourceDefaults);
  normalized.vocabulary = normalized.vocabulary.map((item) => normalizeVocabularyItem(item, sourceDefaults));
  normalized.concepts = normalized.concepts.map((item) => normalizeConceptItem(item, sourceDefaults));
  normalized.referenceFormulas = normalized.referenceFormulas.map((item) => normalizeReferenceFormula(item, sourceDefaults));
  normalized.problemBank = normalized.problemBank.map((item) => normalizeProblemItem(item, sourceDefaults));
  normalized.standardsMap = normalized.standardsMap.map(normalizeStandardsMapItem);
  normalized.smokeTests = normalized.smokeTests.map(normalizeSmokeTest);

  return normalized;
}

function normalizeSourceFiles(sourceFiles, extraction, sourceDefaults) {
  const normalized = sourceFiles.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return normalizeReviewFields({
      ...item,
      fileType: typeof item.fileType === 'string' && item.fileType.trim()
        ? item.fileType
        : sourceDefaults.fileType
    });
  });

  if (sourceDefaults.sourceFile && !normalized.some((item) => {
    return item && typeof item === 'object' && !Array.isArray(item) && item.fileName === sourceDefaults.sourceFile;
  })) {
    normalized.push({
      fileName: sourceDefaults.sourceFile,
      fileType: sourceDefaults.fileType,
      reviewStatus: 'pending',
      confidence: 'low',
      notes: 'Added from extraction metadata for draft traceability.'
    });
  }

  return normalized;
}

function normalizeVocabularyItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    standards: Array.isArray(item.standards) ? item.standards : []
  }), sourceDefaults);
}

function normalizeConceptItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const normalized = { ...item };
  ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions', 'standards'].forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = [];
  });
  return normalizeSourceTracking(normalizeReviewFields(normalized), sourceDefaults);
}

function normalizeReferenceFormula(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    variables: Array.isArray(item.variables) ? item.variables : [],
    solverStatus: 'reference_only'
  }), sourceDefaults);
}

function normalizeProblemItem(item, sourceDefaults) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeSourceTracking(normalizeReviewFields({
    ...item,
    standards: Array.isArray(item.standards) ? item.standards : []
  }), sourceDefaults);
}

function normalizeStandardsMapItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeReviewFields({
    ...item,
    relatedVocabulary: Array.isArray(item.relatedVocabulary) ? item.relatedVocabulary : [],
    relatedConcepts: Array.isArray(item.relatedConcepts) ? item.relatedConcepts : []
  });
}

function normalizeSmokeTest(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return normalizeReviewFields(item);
}

function normalizeReviewFields(item) {
  return {
    ...item,
    reviewStatus: 'pending',
    confidence: ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low'
  };
}

function normalizeSourceTracking(item, sourceDefaults) {
  return {
    ...item,
    sourceFile: nonEmptyString(item.sourceFile) ? item.sourceFile : sourceDefaults.sourceFile,
    sourceLocation: nonEmptyString(item.sourceLocation) ? item.sourceLocation : sourceDefaults.sourceLocation,
    sourceTextSnippet: nonEmptyString(item.sourceTextSnippet) ? item.sourceTextSnippet : sourceDefaults.sourceTextSnippet
  };
}

function makeSourceDefaults(extraction) {
  const metadata = extraction && extraction.metadata && typeof extraction.metadata === 'object'
    ? extraction.metadata
    : {};
  const sourceFile = firstNonEmptyString(
    extraction && extraction.fileName,
    metadata.fileName,
    extraction && extraction.filePath ? path.basename(extraction.filePath) : ''
  );

  return {
    sourceFile,
    fileType: firstNonEmptyString(
      extraction && extraction.extension ? String(extraction.extension).replace(/^\./, '') : '',
      extraction && extraction.mimeGuess,
      metadata.detectedType,
      'unknown'
    ),
    sourceLocation: 'extracted text',
    sourceTextSnippet: makeSourceTextSnippet(extraction && extraction.text)
  };
}

function makeSourceTextSnippet(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Extracted text was used for this draft item.';
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function firstNonEmptyString(...values) {
  return values.find(nonEmptyString) || '';
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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
      if (item.reviewStatus !== 'pending') {
        errors.push(`${sectionName}[${index}].reviewStatus must be "pending" for generated drafts.`);
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

function isLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
}

function blocked(result) {
  return {
    success: false,
    packId: result.packId,
    outputPath: result.outputPath,
    validationPassed: result.validationPassed === true ? true : false,
    warnings: result.warnings || [],
    errors: result.errors || [],
    rawModelResponsePath: result.rawModelResponsePath
  };
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_OLLAMA_URL,
  DEFAULT_RAW_MODEL_RESPONSES_DIR,
  callOllamaGenerate,
  generateDraftKnowledgePack,
  normalizeDraftKnowledgePack,
  parseModelResponse,
  validateDraftSafety
};
