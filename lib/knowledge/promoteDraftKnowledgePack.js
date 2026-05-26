const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_APPROVED_PACKS_DIR } = require('./loadApprovedKnowledgePacks');
const {
  DEFAULT_DRAFT_PACKS_DIR,
  findKnowledgePackFiles
} = require('./loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');
const { hasTeacherLowConfidenceOverride, isLowConfidenceValue } = require('./teacherReviewState');
const { validateKnowledgePack } = require('./validateKnowledgePack');
const { makeDefaultStandardsMetadata } = require('./standardsMetadata');
const { validateStandardsBank } = require('../standards/validateStandardsBank');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const PROMOTABLE_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];
const STRICT_PROMOTION_MODE = 'strict';
const APPROVED_ONLY_PROMOTION_MODE = 'approvedOnly';
const SELECTED_ONLY_PROMOTION_MODE = 'selectedOnly';

function promoteDraftKnowledgePack(draftPackInput, options = {}) {
  const warnings = [];
  const errors = [];
  const draftPacksDir = options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR;
  const approvedPacksDir = options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR;
  const force = options.force === true;
  const promotionScope = buildPromotionScope(options);
  let draftPackPath;
  let pack;
  let standardsBank;

  if (!draftPackInput || typeof draftPackInput !== 'string') {
    return blocked({ warnings, errors: ['A draft pack path or packId is required.'] });
  }

  const resolvedDraft = resolveDraftPackPath(draftPackInput, draftPacksDir);
  if (!resolvedDraft.success) {
    return blocked({ warnings, errors: resolvedDraft.errors });
  }
  draftPackPath = resolvedDraft.draftPackPath;

  const readResult = readJsonFile(draftPackPath, 'draft knowledge pack');
  if (!readResult.success) {
    return blocked({ draftPackPath, warnings, errors: readResult.errors });
  }
  pack = readResult.value;

  if (options.standardsBank) {
    const bankResult = loadStandardsBank(options.standardsBank);
    warnings.push(...bankResult.warnings);
    if (!bankResult.success) {
      return blocked({ draftPackPath, packId: pack && pack.packId, warnings, errors: bankResult.errors });
    }
    standardsBank = bankResult.standardsBank;
  }

  const promotionErrors = validatePromotionReadiness(pack, promotionScope);
  if (promotionErrors.length > 0) {
    return blocked({
      draftPackPath,
      packId: pack.packId,
      warnings,
      errors: promotionErrors,
      validationPassed: false,
      promotionMode: promotionScope.mode
    });
  }

  const safePackId = pack.packId;
  if (!SAFE_PACK_ID_PATTERN.test(safePackId)) {
    return blocked({
      draftPackPath,
      packId: safePackId,
      warnings,
      errors: ['packId must be safe before promotion.'],
      validationPassed: true
    });
  }

  const outputDir = path.join(approvedPacksDir, safePackId);
  const outputPath = path.join(outputDir, KNOWLEDGE_PACK_FILE_NAME);

  if (fs.existsSync(outputPath) && !force) {
    return blocked({
      draftPackPath,
      packId: safePackId,
      outputPath,
      warnings,
      errors: [`Approved pack already exists at ${outputPath}. Pass force: true or --force to overwrite.`],
      validationPassed: true,
      promotionMode: promotionScope.mode
    });
  }

  const approvedPack = buildApprovedKnowledgePack(pack, promotionScope);
  const validation = validateKnowledgePack(approvedPack, { standardsBank });
  warnings.push(...validation.warnings);
  if (!validation.valid) {
    return blocked({
      draftPackPath,
      packId: safePackId,
      outputPath,
      warnings,
      errors: validation.errors,
      validationPassed: false,
      promotionMode: promotionScope.mode
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(approvedPack, null, 2)}\n`);

  return {
    success: true,
    draftPackPath,
    packId: safePackId,
    outputPath,
    warnings,
    errors: [],
    validationPassed: true,
    promotionMode: promotionScope.mode
  };
}

function resolveDraftPackPath(input, draftPacksDir) {
  const inputLooksLikePath = input.includes(path.sep) || input.endsWith('.json') || input.startsWith('.');
  const candidatePath = path.resolve(input);

  if (inputLooksLikePath || fs.existsSync(candidatePath)) {
    const statsPath = fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()
      ? path.join(candidatePath, KNOWLEDGE_PACK_FILE_NAME)
      : candidatePath;

    if (!fs.existsSync(statsPath)) {
      return {
        success: false,
        errors: [`Draft knowledge pack file not found: ${statsPath}`]
      };
    }

    return {
      success: true,
      draftPackPath: statsPath
    };
  }

  const matches = [];
  findKnowledgePackFiles(draftPacksDir).forEach((packPath) => {
    const readResult = readJsonFile(packPath, 'draft knowledge pack');
    if (readResult.success && readResult.value && readResult.value.packId === input) {
      matches.push(packPath);
    }
  });

  if (matches.length === 0) {
    return {
      success: false,
      errors: [`No draft knowledge pack found for packId: ${input}`]
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      errors: [`Multiple draft knowledge packs found for packId ${input}: ${matches.join(', ')}`]
    };
  }

  return {
    success: true,
    draftPackPath: matches[0]
  };
}

function loadStandardsBank(standardsBankInput) {
  if (typeof standardsBankInput === 'string') {
    const readResult = readJsonFile(path.resolve(standardsBankInput), 'standards bank');
    if (!readResult.success) return { ...readResult, warnings: [] };
    return validateStandardsBankForPromotion(readResult.value);
  }

  if (standardsBankInput && typeof standardsBankInput === 'object' && !Array.isArray(standardsBankInput)) {
    return validateStandardsBankForPromotion(standardsBankInput);
  }

  return {
    success: false,
    warnings: [],
    errors: ['standardsBank must be a standards bank object or a path to standards_bank.json.']
  };
}

function validateStandardsBankForPromotion(standardsBank) {
  const validation = validateStandardsBank(standardsBank);
  if (!validation.valid) {
    return {
      success: false,
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

function validatePromotionReadiness(pack, options = {}) {
  const errors = [];
  let approvedCount = 0;
  const promotionScope = buildPromotionScope(options);

  if (promotionScope.mode === SELECTED_ONLY_PROMOTION_MODE && promotionScope.selectedKeys.size === 0) {
    errors.push('At least one selected approved draft item is required before promotion.');
  }

  PROMOTABLE_SECTIONS.forEach((sectionName) => {
    const items = pack[sectionName];
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
      const label = `${sectionName}[${index}]${itemLabel(item)}`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const inScope = isItemInPromotionScope(sectionName, index, promotionScope);

      if (promotionScope.mode === STRICT_PROMOTION_MODE && isPendingReviewStatus(item.reviewStatus)) {
        errors.push(`${label} is still pending teacher review.`);
      }

      if (promotionScope.mode === SELECTED_ONLY_PROMOTION_MODE && inScope && item.reviewStatus !== 'approved') {
        errors.push(`${label} was selected for promotion but is not approved.`);
      }

      if (item.reviewStatus === 'approved' && inScope) {
        const blockers = getApprovedItemPromotionBlockers(sectionName, item, label);
        if (blockers.length) {
          errors.push(...blockers);
        } else {
          approvedCount += 1;
        }
      }
    });
  });

  if (approvedCount === 0) {
    errors.push('At least one approved draft item is required before promotion.');
  }

  return errors;
}

function buildApprovedKnowledgePack(pack, options = {}) {
  const promotionScope = buildPromotionScope(options);
  const approvedPack = JSON.parse(JSON.stringify(pack));
  PROMOTABLE_SECTIONS.forEach((sectionName) => {
    if (!Array.isArray(approvedPack[sectionName])) return;
    approvedPack[sectionName] = approvedPack[sectionName].filter((item, index) => {
      const label = `${sectionName}[${index}]${itemLabel(item)}`;
      return item
        && isItemInPromotionScope(sectionName, index, promotionScope)
        && item.reviewStatus === 'approved'
        && getApprovedItemPromotionBlockers(sectionName, item, label).length === 0;
    });
    approvedPack[sectionName].forEach((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item) && !('standards' in item)) {
        item.standards = makeDefaultStandardsMetadata();
      }
    });
  });
  const importScope = approvedPack.metadata && approvedPack.metadata.importScope;
  if (importScope && typeof importScope === 'object' && !Array.isArray(importScope)) {
    approvedPack.metadata = {
      ...(approvedPack.metadata || {}),
      approvedImportScope: importScope,
      rangeLimitedApprovedPack: importScope.rangeLimited === true || importScope.sampleOnly === true,
      approvalScopeWarning: importScope.warning || ''
    };
  }
  return approvedPack;
}

function buildPromotionScope(options = {}) {
  const mode = normalizePromotionMode(options.promotionMode || options.mode);
  const selectedKeys = options.selectedKeys instanceof Set ? new Set(options.selectedKeys) : new Set();
  if (mode === SELECTED_ONLY_PROMOTION_MODE) {
    normalizeSelectedPromotionItems(options.selectedItems || options.selectedRows || options.items).forEach((entry) => {
      selectedKeys.add(promotionItemKey(entry.section, entry.index));
    });
  }
  return {
    mode,
    selectedKeys
  };
}

function normalizePromotionMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approvedonly' || normalized === 'approved_only' || normalized === 'approved-only') {
    return APPROVED_ONLY_PROMOTION_MODE;
  }
  if (normalized === 'selectedonly' || normalized === 'selected_only' || normalized === 'selected-only') {
    return SELECTED_ONLY_PROMOTION_MODE;
  }
  return STRICT_PROMOTION_MODE;
}

function normalizeSelectedPromotionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => {
      if (typeof entry === 'string') {
        const [section, rawIndex] = entry.split(':');
        return { section, index: Number(rawIndex) };
      }
      return {
        section: String(entry && (entry.section || entry.category) || '').trim(),
        index: Number(entry && entry.index)
      };
    })
    .filter((entry) => PROMOTABLE_SECTIONS.includes(entry.section) && Number.isInteger(entry.index) && entry.index >= 0);
}

function isItemInPromotionScope(sectionName, index, promotionScope) {
  if (!promotionScope || promotionScope.mode !== SELECTED_ONLY_PROMOTION_MODE) return true;
  return promotionScope.selectedKeys.has(promotionItemKey(sectionName, index));
}

function promotionItemKey(sectionName, index) {
  return `${sectionName}:${Number(index)}`;
}

function isPendingReviewStatus(reviewStatus) {
  return reviewStatus === 'pending' || reviewStatus === 'needs_review';
}

function getApprovedItemPromotionBlockers(sectionName, item, label) {
  const blockers = [];
  if (!isApprovedItemSourceGrounded(item)) {
    blockers.push(`${label} is approved but does not have valid source-grounding evidence.`);
  }
  const missingSourceFields = missingRequiredSourceTrackingFields(item);
  if (missingSourceFields.length) {
    blockers.push(`${label} is approved but missing required source tracking: ${missingSourceFields.join(', ')}.`);
  }
  if (hasUnsafeDraftState(item)) {
    blockers.push(`${label} is approved but marked invalid, quarantined, rejected, repair-needed, or repair-failed.`);
  }
  if (isLowConfidenceValue(item.confidence) && !hasTeacherLowConfidenceOverride(item)) {
    blockers.push(`${label} is approved but still has low confidence.`);
  }
  if (sectionName === 'referenceFormulas' && item.solverStatus !== 'reference_only') {
    blockers.push(`${label}.solverStatus must remain "reference_only" before promotion.`);
  }
  return blockers;
}

function missingRequiredSourceTrackingFields(item) {
  return ['sourceFile', 'sourceLocation', 'sourceTextSnippet'].filter((field) => {
    return !item || typeof item[field] !== 'string' || item[field].trim().length === 0;
  });
}

function hasUnsafeDraftState(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return true;
  const unsafeText = [
    item.validationStatus,
    item.repairStatus,
    item.quarantineStatus,
    item.warningStatus,
    item.extractionStatus,
    item.modelStatus,
    ...(Array.isArray(item.validationErrors) ? item.validationErrors : []),
    ...(Array.isArray(item.warnings) ? item.warnings : [])
  ].filter(Boolean).join(' ').toLowerCase();
  return /\b(rejected|reject|quarantine|quarantined|invalid|repair[_ -]?needed|repair[_ -]?failed|missing required)\b/.test(unsafeText);
}

function isApprovedItemSourceGrounded(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const grounding = item.sourceGrounding && typeof item.sourceGrounding === 'object' && !Array.isArray(item.sourceGrounding)
    ? item.sourceGrounding
    : null;
  if (!grounding) return true;
  if (grounding.status !== 'supported') return false;
  if (grounding.termOrTitleFound === false) return false;
  if (grounding.explanationSupported === false) return false;
  return true;
}

function itemLabel(item) {
  if (!item || typeof item !== 'object') return '';

  const id = item.term || item.conceptId || item.formulaId || item.problemId || item.standardId;
  return id ? ` (${id})` : '';
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

function blocked(result) {
  return {
    success: false,
    outputPath: result.outputPath,
    draftPackPath: result.draftPackPath,
    packId: result.packId,
    validationPassed: result.validationPassed === true ? true : false,
    promotionMode: result.promotionMode,
    warnings: result.warnings || [],
    errors: result.errors || []
  };
}

module.exports = {
  APPROVED_ONLY_PROMOTION_MODE,
  PROMOTABLE_SECTIONS,
  SELECTED_ONLY_PROMOTION_MODE,
  STRICT_PROMOTION_MODE,
  buildApprovedKnowledgePack,
  promoteDraftKnowledgePack,
  resolveDraftPackPath,
  validatePromotionReadiness
};
