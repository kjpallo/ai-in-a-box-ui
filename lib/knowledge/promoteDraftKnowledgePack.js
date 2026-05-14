const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_APPROVED_PACKS_DIR } = require('./loadApprovedKnowledgePacks');
const {
  DEFAULT_DRAFT_PACKS_DIR,
  findKnowledgePackFiles
} = require('./loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');
const { validateKnowledgePack } = require('./validateKnowledgePack');
const { validateStandardsBank } = require('../standards/validateStandardsBank');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const PROMOTABLE_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap'
];

function promoteDraftKnowledgePack(draftPackInput, options = {}) {
  const warnings = [];
  const errors = [];
  const draftPacksDir = options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR;
  const approvedPacksDir = options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR;
  const force = options.force === true;
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

  const validation = validateKnowledgePack(pack, { standardsBank });
  warnings.push(...validation.warnings);
  if (!validation.valid) {
    return blocked({
      draftPackPath,
      packId: pack && pack.packId,
      warnings,
      errors: validation.errors,
      validationPassed: false
    });
  }

  const promotionErrors = validatePromotionReadiness(pack);
  if (promotionErrors.length > 0) {
    return blocked({
      draftPackPath,
      packId: pack.packId,
      warnings,
      errors: promotionErrors,
      validationPassed: true
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
      validationPassed: true
    });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(pack, null, 2)}\n`);

  return {
    success: true,
    draftPackPath,
    packId: safePackId,
    outputPath,
    warnings,
    errors: [],
    validationPassed: true
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

function validatePromotionReadiness(pack) {
  const errors = [];

  PROMOTABLE_SECTIONS.forEach((sectionName) => {
    const items = pack[sectionName];
    if (!Array.isArray(items)) return;

    items.forEach((item, index) => {
      const label = `${sectionName}[${index}]${itemLabel(item)}`;

      if (item.reviewStatus === 'pending') {
        errors.push(`${label} is still pending teacher review.`);
      } else if (item.reviewStatus === 'rejected') {
        errors.push(`${label} has been rejected and cannot be promoted.`);
      } else if (item.reviewStatus !== 'approved') {
        errors.push(`${label} must have reviewStatus "approved" before promotion.`);
      }

      if (sectionName === 'referenceFormulas' && item.solverStatus !== 'reference_only') {
        errors.push(`${label}.solverStatus must remain "reference_only" before promotion.`);
      }
    });
  });

  return errors;
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
    warnings: result.warnings || [],
    errors: result.errors || []
  };
}

module.exports = {
  PROMOTABLE_SECTIONS,
  promoteDraftKnowledgePack,
  resolveDraftPackPath,
  validatePromotionReadiness
};
