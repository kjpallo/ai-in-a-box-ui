const fs = require('node:fs');
const path = require('node:path');

const { getDraftPackReport } = require('../uploads/teacherContentAdapter');
const {
  REVIEWABLE_SECTIONS,
  applyDraftItemReviewDecision,
  editDraftItemField,
  updateDraftItemReviewStatus
} = require('./reviewDraftKnowledgePack');
const { DEFAULT_DRAFT_PACKS_DIR } = require('./loadDraftKnowledgePacks');
const {
  firstNonEmptyString,
  isSafePackId,
  nonEmptyString,
  readJsonFile
} = require('../server/routeResponse');

function validateDraftItemRouteParams(params = {}) {
  const packId = String(params.packId || '').trim();
  if (!isSafePackId(packId)) {
    return {
      success: false,
      errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
    };
  }

  const section = String(params.section || '').trim();
  if (!REVIEWABLE_SECTIONS.includes(section)) {
    return {
      success: false,
      errors: [`section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`]
    };
  }

  const index = Number(params.index);
  if (!Number.isInteger(index) || index < 0 || String(params.index).trim() !== String(index)) {
    return {
      success: false,
      errors: [`index must be a non-negative integer for ${section}.`]
    };
  }

  return {
    success: true,
    packId,
    section,
    index,
    errors: []
  };
}

function extractDraftItemRef(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const itemId = String(input.itemId || '').trim();
  const sourceFile = String(input.sourceFile || '').trim();
  const sourceLocation = String(input.sourceLocation || '').trim();
  const title = String(input.title || '').trim();
  const term = String(input.term || '').trim();
  if (!itemId && !sourceFile && !sourceLocation && !title && !term) return null;
  return { itemId, sourceFile, sourceLocation, title, term };
}

function resolveDraftItemMutationTarget({ packId, section, requestedIndex, itemRef, options = {} }) {
  const parsedIndex = Number(requestedIndex);
  const fallback = {
    success: true,
    index: parsedIndex,
    requestedIndex: parsedIndex,
    resolvedBy: 'index'
  };
  if (!itemRef) return fallback;

  const draft = loadDraftPackJsonForRoute(packId, options);
  if (!draft.success) {
    return {
      success: false,
      statusCode: 404,
      errors: draft.errors || ['Draft pack could not be loaded for item resolution.']
    };
  }

  const items = Array.isArray(draft.pack && draft.pack[section]) ? draft.pack[section] : [];
  if (!items.length) {
    return {
      success: false,
      statusCode: 400,
      errors: [`No items found in section ${section}.`]
    };
  }

  if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < items.length && draftItemMatchesRef(items[parsedIndex], itemRef)) {
    return {
      success: true,
      index: parsedIndex,
      requestedIndex: parsedIndex,
      resolvedBy: 'index_and_itemRef'
    };
  }

  const matchedIndices = items
    .map((item, index) => (draftItemMatchesRef(item, itemRef) ? index : -1))
    .filter((index) => index >= 0);
  if (matchedIndices.length === 1) {
    return {
      success: true,
      index: matchedIndices[0],
      requestedIndex: parsedIndex,
      resolvedBy: 'itemRef'
    };
  }
  if (matchedIndices.length > 1) {
    return {
      success: false,
      statusCode: 409,
      errors: ['Multiple draft items matched this edit request. Reopen the row and try again so the latest item identity is used.'],
      matchedIndices
    };
  }
  return {
    success: false,
    statusCode: 409,
    errors: ['The selected draft item changed after refresh. Reopen the row and try again.'],
    requestedIndex: parsedIndex
  };
}

function updateDraftItemStatusForRoute({
  packId,
  section,
  index,
  reviewStatus,
  edits = [],
  options = {}
}) {
  return edits.length > 0
    ? applyDraftItemReviewDecision(
      packId,
      section,
      index,
      {
        reviewStatus,
        edits
      },
      options
    )
    : updateDraftItemReviewStatus(
      packId,
      section,
      index,
      reviewStatus,
      options
    );
}

function editDraftItemFieldForRoute({
  packId,
  section,
  index,
  field,
  value,
  options = {}
}) {
  return editDraftItemField(
    packId,
    section,
    index,
    field,
    value,
    options
  );
}

function loadDraftPackJsonForRoute(packId, options = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const readResult = readJsonFile(draftPackPath, `draft pack ${packId}`);
  if (!readResult.success) {
    return {
      success: false,
      draftPackPath,
      errors: readResult.errors || ['Draft pack could not be read.']
    };
  }
  return {
    success: true,
    draftPackPath,
    pack: readResult.value
  };
}

function draftItemMatchesRef(item, itemRef) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const hasItemId = nonEmptyString(itemRef && itemRef.itemId);
  const hasSourceFile = nonEmptyString(itemRef && itemRef.sourceFile);
  const hasSourceLocation = nonEmptyString(itemRef && itemRef.sourceLocation);
  const hasTitle = nonEmptyString(itemRef && itemRef.title);
  const hasTerm = nonEmptyString(itemRef && itemRef.term);

  const itemIdMatches = !hasItemId || normalizeComparableString(draftItemIdentity(item)) === normalizeComparableString(itemRef.itemId);
  const sourceFileMatches = !hasSourceFile || normalizeComparableString(item.sourceFile) === normalizeComparableString(itemRef.sourceFile);
  const sourceLocationMatches = !hasSourceLocation || normalizeComparableString(item.sourceLocation) === normalizeComparableString(itemRef.sourceLocation);
  const titleMatches = !hasTitle || normalizeComparableString(item.title) === normalizeComparableString(itemRef.title);
  const termMatches = !hasTerm || normalizeComparableString(item.term) === normalizeComparableString(itemRef.term);
  if (hasItemId && (hasSourceFile || hasSourceLocation)) {
    return itemIdMatches && sourceFileMatches && sourceLocationMatches;
  }
  if (hasItemId) return itemIdMatches;
  if (hasSourceFile || hasSourceLocation) {
    return sourceFileMatches && sourceLocationMatches && titleMatches && termMatches;
  }
  if (hasTitle || hasTerm) return titleMatches && termMatches;
  return false;
}

function draftItemIdentity(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  return firstNonEmptyString(
    item.itemId,
    item.term,
    item.title,
    item.question,
    item.equation,
    item.standardId,
    item.conceptId,
    item.formulaId,
    item.problemId
  );
}

function normalizeComparableString(value) {
  return String(value || '').trim().toLowerCase();
}

function sendDraftMutationResponse(res, update, packId, options, debugContext = {}) {
  const debug = buildDraftMutationDebugPayload(update, packId, options, debugContext);
  if (!update.success) {
    const status = (update.errors || []).some((error) => String(error).includes('No draft knowledge pack found'))
      ? 404
      : 400;
    return res.status(status).json({
      success: false,
      errors: update.errors || ['Draft item update failed.'],
      warnings: update.warnings || [],
      debug
    });
  }

  const report = getDraftPackReport(packId, options);
  return res.json({
    success: true,
    data: {
      update,
      report,
      debug: {
        ...debug,
        refreshedItem: summarizeReportItem(report, debugContext.request && debugContext.request.section, debugContext.request && debugContext.request.index),
        remainingBlockers: summarizeRemainingBlockers(report)
      }
    },
    errors: [],
    warnings: report.warnings || []
  });
}

function buildDraftMutationDebugPayload(update, packId, options, debugContext = {}) {
  const request = debugContext.request && typeof debugContext.request === 'object' ? debugContext.request : {};
  const beforeSnapshot = debugContext.beforeSnapshot || null;
  const afterSnapshot = debugContext.afterSnapshot || null;
  const draftPackPath = update && update.draftPackPath ? update.draftPackPath : resolveDraftPackJsonPath(packId, options);
  const fileStats = safeFileStats(draftPackPath);

  return {
    routeHandler: debugContext.routeHandler || '',
    request,
    draftPackPath,
    updateSummary: summarizeDraftMutationUpdate(update),
    beforeSnapshot,
    afterSnapshot,
    savedPath: update && update.savedPath ? update.savedPath : null,
    diskState: {
      exists: fileStats.exists,
      mtimeMs: fileStats.mtimeMs
    }
  };
}

function summarizeDraftMutationUpdate(update = {}) {
  return {
    success: update.success === true,
    action: update.action || '',
    changedField: update.changedField || '',
    editedFields: Array.isArray(update.editedFields) ? update.editedFields : [],
    before: Object.prototype.hasOwnProperty.call(update, 'before') ? update.before : undefined,
    after: Object.prototype.hasOwnProperty.call(update, 'after') ? update.after : undefined,
    validationPassed: update.validationPassed === true,
    errors: Array.isArray(update.errors) ? update.errors : [],
    warnings: Array.isArray(update.warnings) ? update.warnings : []
  };
}

function summarizeRemainingBlockers(report = {}) {
  const readiness = report && report.promotionReadiness && typeof report.promotionReadiness === 'object'
    ? report.promotionReadiness
    : {};
  const blockedReasons = Array.isArray(readiness.blockedReasons) ? readiness.blockedReasons : [];
  const blockerSummary = readiness.blockerSummary && typeof readiness.blockerSummary === 'object'
    ? readiness.blockerSummary
    : null;
  return {
    ready: readiness.ready === true,
    blockedReasons,
    blockerSummary: blockerSummary && typeof blockerSummary.message === 'string'
      ? blockerSummary.message
      : ''
  };
}

function summarizeReportItem(report, section, index) {
  if (!report || !section || !Number.isInteger(Number(index))) return null;
  const groups = report.reviewItems && report.reviewItems.items && typeof report.reviewItems.items === 'object'
    ? report.reviewItems.items
    : {};
  const row = Array.isArray(groups[section])
    ? groups[section].find((item) => Number(item && item.index) === Number(index))
    : null;
  if (!row || typeof row !== 'object') return null;
  return {
    section,
    index: Number(index),
    itemId: row.itemId || row.term || row.title || row.standardId || '',
    reviewStatus: row.reviewStatus || '',
    teacherReviewed: row.teacherReviewed === true,
    teacherVerified: row.teacherVerified === true,
    manuallyEdited: row.manuallyEdited === true,
    confidenceOverride: row.confidenceOverride || '',
    sourceFile: row.sourceFile || '',
    sourceLocation: row.sourceLocation || '',
    sourceTextSnippetLength: String(row.sourceTextSnippet || '').trim().length
  };
}

function readDraftItemSnapshot(packId, section, index, options = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const readResult = readJsonFile(draftPackPath, `draft pack ${packId}`);
  if (!readResult.success || !readResult.value) {
    return {
      success: false,
      draftPackPath,
      errors: readResult.errors || ['Draft pack could not be read.']
    };
  }

  const sectionItems = Array.isArray(readResult.value[section]) ? readResult.value[section] : [];
  const row = sectionItems[Number(index)];
  if (!row || typeof row !== 'object') {
    return {
      success: false,
      draftPackPath,
      errors: [`No item found at ${section}[${index}].`]
    };
  }

  return {
    success: true,
    draftPackPath,
    item: summarizeDraftFileItem(section, Number(index), row)
  };
}

function summarizeDraftFileItem(section, index, item = {}) {
  return {
    section,
    index,
    itemId: item.itemId || item.term || item.title || item.standardId || '',
    reviewStatus: item.reviewStatus || '',
    teacherReviewed: item.teacherReviewed === true,
    teacherVerified: item.teacherVerified === true,
    manuallyEdited: item.manuallyEdited === true,
    teacherApproved: item.teacherApproved === true,
    confidence: item.confidence || '',
    confidenceOverride: item.confidenceOverride || '',
    term: item.term || '',
    title: item.title || '',
    studentDefinition: item.studentDefinition || '',
    studentExplanation: item.studentExplanation || '',
    equation: item.equation || '',
    question: item.question || '',
    expectedAnswer: item.expectedAnswer || '',
    standardId: item.standardId || '',
    sourceFile: item.sourceFile || '',
    sourceLocation: item.sourceLocation || '',
    sourceTextSnippetLength: String(item.sourceTextSnippet || '').trim().length,
    missingRequiredFields: summarizeMissingRequiredFields(item)
  };
}

function summarizeMissingRequiredFields(item = {}) {
  const missing = [];
  if (!nonEmptyString(item.sourceFile)) missing.push('sourceFile');
  if (!nonEmptyString(item.sourceLocation)) missing.push('sourceLocation');
  if (!nonEmptyString(item.sourceTextSnippet)) missing.push('sourceTextSnippet');
  const hasIdentifier = nonEmptyString(item.term)
    || nonEmptyString(item.title)
    || nonEmptyString(item.question)
    || nonEmptyString(item.equation)
    || nonEmptyString(item.standardId);
  if (!hasIdentifier) missing.push('identifier');
  return missing;
}

function resolveDraftPackJsonPath(packId, options = {}) {
  const draftRoot = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  return path.resolve(draftRoot, packId, 'knowledge_pack.json');
}

function safeFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      mtimeMs: Number(stats.mtimeMs || 0)
    };
  } catch (_error) {
    return {
      exists: false,
      mtimeMs: 0
    };
  }
}

function buildPromotionDebugPayload(packId, options, report, promotion = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const draftFileStats = safeFileStats(draftPackPath);
  const draftSnapshot = readDraftItemSnapshot(packId, 'vocabulary', 0, options);
  const reportReady = report && report.promotionReadiness && report.promotionReadiness.ready === true;
  const blockedReasons = report && report.promotionReadiness && Array.isArray(report.promotionReadiness.blockedReasons)
    ? report.promotionReadiness.blockedReasons
    : [];
  return {
    packId,
    promotionSuccess: promotion.success === true,
    draftPackPath,
    draftFileMtimeMs: draftFileStats.mtimeMs,
    draftSnapshotPreview: draftSnapshot.success ? draftSnapshot.item : null,
    promotionReadinessReady: reportReady,
    blockedReasons,
    promotionOutputPath: promotion.outputPath || null
  };
}

module.exports = {
  buildPromotionDebugPayload,
  editDraftItemFieldForRoute,
  extractDraftItemRef,
  readDraftItemSnapshot,
  resolveDraftItemMutationTarget,
  sendDraftMutationResponse,
  updateDraftItemStatusForRoute,
  validateDraftItemRouteParams
};
