const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { archiveDraftKnowledgePackFromReviewQueue } = require('./archiveAcceptedDraftKnowledgePack');
const { setApprovedPackActivation } = require('./approvedPackActivationStore');
const { DEFAULT_APPROVED_PACKS_DIR, findKnowledgePackFiles: findApprovedKnowledgePackFiles } = require('./loadApprovedKnowledgePacks');
const { DEFAULT_DRAFT_PACKS_DIR } = require('./loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');
const { makeDefaultStandardsMetadata } = require('./standardsMetadata');
const { hasTeacherLowConfidenceOverride, isLowConfidenceValue, stampTeacherReview } = require('./teacherReviewState');
const { validateKnowledgePack } = require('./validateKnowledgePack');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const REVIEWABLE_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];
const BLOCKING_STATUS_PATTERN = /\b(rejected|reject|quarantine|quarantined|invalid|repair[_ -]?failed|missing required)\b/;

function approveCombinedReviewRows(input = {}, options = {}) {
  const now = String(options.now || new Date().toISOString());
  const nowDate = String(now).slice(0, 10);
  const draftPacksDir = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  assertAbsoluteDirectory(draftPacksDir, 'draft-packs');
  assertAbsoluteDirectory(approvedPacksDir, 'approved-packs');

  const mode = normalizeCombinedApprovalMode(input.mode);
  const draftPackId = normalizeSafePackId(input.draftPackId || input.packId);
  const selectedRows = normalizeSelectedRows(input.rows || input.items || input.selectedItems || input.selectedRows);

  const draftCache = new Map();
  const acceptedRows = [];
  const skipped = {
    rejected: 0,
    blocked: 0,
    stale: 0,
    missingDraft: 0
  };

  if (mode === 'final_publish') {
    if (!SAFE_PACK_ID_PATTERN.test(draftPackId)) {
      return blocked('draftPackId is required for final publish mode and must be safe.');
    }

    const draftRecord = loadDraftRecord(draftPackId, draftPacksDir, draftCache);
    if (!draftRecord.success) {
      return blocked('Draft pack could not be loaded for final publish.', {
        skipped: {
          ...skipped,
          missingDraft: 1
        }
      });
    }

    const publishable = collectPublishableRowsFromDraftPack(draftRecord.pack, {
      draftPackId,
      sourcePackName: draftRecord.pack && draftRecord.pack.title
    });
    skipped.rejected += publishable.skipped.rejected;
    skipped.blocked += publishable.skipped.blocked;
    acceptedRows.push(...publishable.acceptedRows);
  } else {
    if (!selectedRows.length) {
      return blocked('No review rows were provided for combined approval.');
    }

    selectedRows.forEach((row) => {
      const draftRecord = loadDraftRecord(row.draftPackId, draftPacksDir, draftCache);
      if (!draftRecord.success) {
        skipped.missingDraft += 1;
        return;
      }

      const resolved = resolveSelectionTarget(draftRecord.pack, row);
      if (!resolved.success) {
        skipped.stale += 1;
        return;
      }

      const item = resolved.item;
      const status = normalizeReviewStatus(item && item.reviewStatus);
      if (status === 'rejected') {
        skipped.rejected += 1;
        return;
      }

      let blockers = getApprovedItemPromotionBlockers(row.section, item);
      if (isLowConfidenceOnlyBlockers(blockers)) {
        stampTeacherReview(item, { approved: true });
        blockers = getApprovedItemPromotionBlockers(row.section, item);
      }
      if (blockers.length) {
        skipped.blocked += 1;
        return;
      }

      if (isPendingReviewStatus(status)) {
        item.reviewStatus = 'approved';
        stampTeacherReview(item, { approved: true });
      } else if (status !== 'approved') {
        item.reviewStatus = 'approved';
        stampTeacherReview(item, { approved: true });
      }

      acceptedRows.push({
        draftPackId: row.draftPackId,
        sourcePackName: row.sourcePackName || draftRecord.pack.title || row.draftPackId,
        section: row.section,
        resolvedIndex: resolved.index,
        item: cloneValue(item)
      });
    });
  }

  if (!acceptedRows.length) {
    return blocked(mode === 'final_publish' ? 'No valid rows were available for final publish.' : 'No selected rows were valid for combined approval.', {
      skipped,
      draftPackId: mode === 'final_publish' ? draftPackId : undefined
    });
  }

  const combinedContext = mode === 'final_publish'
    ? buildFinalPublishContext({
      nowDate,
      draftPackId,
      draftPack: (draftCache.get(draftPackId) && draftCache.get(draftPackId).pack) || null,
      reviewBatchName: input.reviewBatchName
    })
    : buildCombinedContext({
      nowDate,
      reviewBatchName: input.reviewBatchName,
      reviewBatchPackIds: input.reviewBatchPackIds,
      acceptedRows
    });
  const existingCombined = mode === 'final_publish'
    ? null
    : findExistingCombinedPack(approvedPacksDir, combinedContext.reviewBatchKey);
  const basePack = existingCombined
    ? cloneValue(existingCombined.pack)
    : buildBaseCombinedPack(combinedContext, acceptedRows, draftCache, now);
  const mergedPack = mergeAcceptedRowsIntoCombinedPack(basePack, acceptedRows, combinedContext, now, draftCache);

  const validation = validateKnowledgePack(mergedPack, {
    standardsPaused: true,
    ...(options.validationOptions || {}),
    standardsBank: options.standardsBank
  });
  if (!validation.valid) {
    return blocked('Combined approved pack validation failed.', {
      errors: validation.errors
    });
  }

  const combinedOutputPath = resolvePackFilePath(approvedPacksDir, mergedPack.packId);
  fs.mkdirSync(path.dirname(combinedOutputPath), { recursive: true });
  fs.writeFileSync(combinedOutputPath, `${JSON.stringify(mergedPack, null, 2)}\n`);

  const updatedDraftPackIds = [];
  const archivedDrafts = [];
  let activation = null;
  try {
    activation = setApprovedPackActivation(mergedPack.packId, true, {
      ...options,
      approvedPacksDir
    });
  } catch (error) {
    return blocked('Approved pack was created, but it could not be activated.', {
      skipped,
      errors: [error instanceof Error ? error.message : String(error)]
    });
  }

  if (mode === 'final_publish') {
    if (SAFE_PACK_ID_PATTERN.test(draftPackId)) {
      const archived = archiveDraftKnowledgePackFromReviewQueue(draftPackId, {
        ...options,
        draftPacksDir,
        approvedPacksDir
      });
      archivedDrafts.push(archived);
      updatedDraftPackIds.push(draftPackId);
    }
  } else {
    const acceptedTargetsByPack = buildAcceptedTargetsByPack(acceptedRows);
    Array.from(acceptedTargetsByPack.keys()).forEach((targetDraftPackId) => {
      const draftRecord = draftCache.get(targetDraftPackId);
      if (!draftRecord || !draftRecord.success) return;
      const removed = removeAcceptedRowsFromDraftPack(draftRecord.pack, acceptedTargetsByPack.get(targetDraftPackId));
      if (!removed) return;
      const draftPath = resolvePackFilePath(draftPacksDir, targetDraftPackId);
      fs.writeFileSync(draftPath, `${JSON.stringify(draftRecord.pack, null, 2)}\n`);
      updatedDraftPackIds.push(targetDraftPackId);

      if (countVisibleDraftRows(draftRecord.pack) === 0) {
        const archived = archiveDraftKnowledgePackFromReviewQueue(targetDraftPackId, {
          ...options,
          draftPacksDir,
          approvedPacksDir
        });
        archivedDrafts.push(archived);
      }
    });
  }

  return {
    success: true,
    mode,
    acceptedCount: acceptedRows.length,
    skipped,
    combinedPack: {
      packId: mergedPack.packId,
      title: mergedPack.title,
      outputPath: combinedOutputPath
    },
    activation,
    finalPublish: mode === 'final_publish',
    draftPackId: mode === 'final_publish' ? draftPackId : undefined,
    updatedDraftPackIds,
    archivedDrafts,
    warnings: validation.warnings || [],
    errors: []
  };
}

function normalizeCombinedApprovalMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'all_valid' || mode === 'allvalid') return 'all_valid';
  if (mode === 'final_publish' || mode === 'final-publish' || mode === 'final') return 'final_publish';
  return 'selected';
}

function normalizeSafePackId(value) {
  return String(value || '').trim();
}

function collectPublishableRowsFromDraftPack(pack, context = {}) {
  const acceptedRows = [];
  const skipped = {
    rejected: 0,
    blocked: 0
  };
  const draftPackId = String(context.draftPackId || '').trim();
  const sourcePackName = String(context.sourcePackName || draftPackId || '').trim();
  REVIEWABLE_SECTIONS.forEach((section) => {
    const sectionItems = Array.isArray(pack && pack[section]) ? pack[section] : [];
    sectionItems.forEach((item, index) => {
      const status = normalizeReviewStatus(item && item.reviewStatus);
      if (status === 'rejected') {
        skipped.rejected += 1;
        return;
      }
      if (!isFinalPublishableDraftItem(section, item)) {
        skipped.blocked += 1;
        return;
      }
      if (status !== 'approved') {
        item.reviewStatus = 'approved';
        stampTeacherReview(item, { approved: true });
      }
      acceptedRows.push({
        draftPackId,
        sourcePackName,
        section,
        resolvedIndex: index,
        item: cloneValue(item)
      });
    });
  });
  return {
    acceptedRows,
    skipped
  };
}

function buildFinalPublishContext({ nowDate, draftPackId, draftPack, reviewBatchName }) {
  const title = String(reviewBatchName || (draftPack && draftPack.title) || draftPackId || `Approved Knowledge Pack - ${nowDate}`).trim();
  return {
    title: title || `Approved Knowledge Pack - ${nowDate}`,
    packId: draftPackId,
    reviewBatchName: title || draftPackId,
    reviewBatchKey: `final-publish-${draftPackId}`,
    contextPackIds: [draftPackId]
  };
}

function normalizeSelectedRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map((entry) => {
      const draftPackId = String(entry && entry.draftPackId || '').trim();
      const section = String(entry && entry.section || '').trim();
      const index = Number(entry && entry.index);
      if (!SAFE_PACK_ID_PATTERN.test(draftPackId)) return null;
      if (!REVIEWABLE_SECTIONS.includes(section)) return null;
      if (!Number.isInteger(index) || index < 0) return null;
      const itemRef = entry && typeof entry.itemRef === 'object' && !Array.isArray(entry.itemRef)
        ? normalizeItemRef(entry.itemRef)
        : null;
      const sourcePackName = String(entry && entry.sourcePackName || '').trim();
      const key = `${draftPackId}:${section}:${index}:${itemRef ? JSON.stringify(itemRef) : ''}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        draftPackId,
        section,
        index,
        itemRef,
        sourcePackName
      };
    })
    .filter(Boolean);
}

function normalizeItemRef(itemRef = {}) {
  const ref = {
    itemId: String(itemRef.itemId || '').trim(),
    sourceFile: String(itemRef.sourceFile || '').trim(),
    sourceLocation: String(itemRef.sourceLocation || '').trim(),
    title: String(itemRef.title || '').trim(),
    term: String(itemRef.term || '').trim()
  };
  return Object.values(ref).some(Boolean) ? ref : null;
}

function loadDraftRecord(packId, draftPacksDir, cache) {
  if (cache.has(packId)) return cache.get(packId);
  try {
    const packPath = resolvePackFilePath(draftPacksDir, packId);
    const parsed = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const record = { success: true, packId, packPath, pack: parsed };
    cache.set(packId, record);
    return record;
  } catch (error) {
    const record = {
      success: false,
      packId,
      errors: [error instanceof Error ? error.message : String(error)]
    };
    cache.set(packId, record);
    return record;
  }
}

function resolveSelectionTarget(pack, row) {
  const sectionItems = Array.isArray(pack && pack[row.section]) ? pack[row.section] : [];
  if (!sectionItems.length) return { success: false };

  if (row.itemRef) {
    const exact = sectionItems[row.index];
    if (isItemRefMatch(exact, row.itemRef)) {
      return { success: true, index: row.index, item: exact };
    }
    const matches = sectionItems
      .map((item, index) => ({ item, index }))
      .filter((entry) => isItemRefMatch(entry.item, row.itemRef));
    if (matches.length === 1) {
      return { success: true, index: matches[0].index, item: matches[0].item };
    }
    return { success: false };
  }

  const fallback = sectionItems[row.index];
  if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) return { success: false };
  return { success: true, index: row.index, item: fallback };
}

function isItemRefMatch(item, itemRef) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const identity = draftItemIdentity(item);
  if (itemRef.itemId && normalizeComparableString(identity) !== normalizeComparableString(itemRef.itemId)) return false;
  if (itemRef.sourceFile && normalizeComparableString(item.sourceFile) !== normalizeComparableString(itemRef.sourceFile)) return false;
  if (itemRef.sourceLocation && normalizeComparableString(item.sourceLocation) !== normalizeComparableString(itemRef.sourceLocation)) return false;
  if (itemRef.term && normalizeComparableString(item.term) !== normalizeComparableString(itemRef.term)) return false;
  if (itemRef.title && normalizeComparableString(item.title) !== normalizeComparableString(itemRef.title)) return false;
  return true;
}

function draftItemIdentity(item) {
  return String(
    item && (
      item.itemId
      || item.term
      || item.title
      || item.question
      || item.equation
      || item.standardId
      || item.conceptId
      || item.formulaId
      || item.problemId
    )
    || ''
  ).trim();
}

function normalizeComparableString(value) {
  return String(value || '').trim().toLowerCase();
}

function buildCombinedContext({ nowDate, reviewBatchName, reviewBatchPackIds, acceptedRows }) {
  const batchName = String(reviewBatchName || '').trim();
  const sourcePackIds = Array.from(new Set(acceptedRows.map((row) => row.draftPackId)));
  const contextPackIds = Array.isArray(reviewBatchPackIds) && reviewBatchPackIds.length
    ? Array.from(new Set(reviewBatchPackIds.map((packId) => String(packId || '').trim()).filter((packId) => SAFE_PACK_ID_PATTERN.test(packId)))).sort()
    : sourcePackIds.sort();
  const keySeed = `${batchName.toLowerCase()}::${contextPackIds.join('|')}`;
  const keyHash = crypto.createHash('sha1').update(keySeed).digest('hex').slice(0, 10);
  const reviewBatchKey = `combined-review-${keyHash}`;

  let title = batchName;
  if (!title) {
    title = sourcePackIds.length > 1
      ? `Combined Knowledge Pack - ${nowDate}`
      : String(acceptedRows[0] && acceptedRows[0].sourcePackName || 'Combined Knowledge Pack').trim();
  }

  const slug = slugify(title) || 'combined-knowledge-pack';
  const packId = `${slug}-${keyHash}`.replace(/-+/g, '-').slice(0, 120);
  return {
    title,
    packId: SAFE_PACK_ID_PATTERN.test(packId) ? packId : `combined-${keyHash}`,
    reviewBatchName: batchName,
    reviewBatchKey,
    contextPackIds
  };
}

function findExistingCombinedPack(approvedPacksDir, reviewBatchKey) {
  const files = findApprovedKnowledgePackFiles(approvedPacksDir);
  for (const filePath of files) {
    try {
      const pack = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const metadata = pack && pack.metadata && typeof pack.metadata === 'object' ? pack.metadata : {};
      const combined = metadata.combinedApproval && typeof metadata.combinedApproval === 'object'
        ? metadata.combinedApproval
        : {};
      if (String(combined.reviewBatchKey || '') === String(reviewBatchKey || '')) {
        return { pack, filePath };
      }
    } catch (_error) {
      // Ignore invalid packs.
    }
  }
  return null;
}

function buildBaseCombinedPack(context, acceptedRows, draftCache, now) {
  const sourcePacks = acceptedRows
    .map((row) => draftCache.get(row.draftPackId))
    .filter((record) => record && record.success)
    .map((record) => record.pack);
  const firstPack = sourcePacks[0] || {};
  const sourceFiles = sourcePacks.flatMap((pack) => Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : []);

  return {
    packId: context.packId,
    title: context.title,
    version: '1.0.0',
    subject: String(firstPack.subject || 'Teacher Content').trim(),
    gradeLevel: String(firstPack.gradeLevel || 'Teacher Review').trim(),
    sourceFiles: dedupeSourceFiles(sourceFiles),
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: [],
    metadata: {
      createdBy: 'teacher-content-review',
      createdAt: now
    }
  };
}

function mergeAcceptedRowsIntoCombinedPack(basePack, acceptedRows, context, now, draftCache) {
  const pack = cloneValue(basePack);
  REVIEWABLE_SECTIONS.forEach((section) => {
    if (!Array.isArray(pack[section])) pack[section] = [];
  });

  const sourceFiles = dedupeSourceFiles([
    ...(Array.isArray(pack.sourceFiles) ? pack.sourceFiles : []),
    ...acceptedRows.flatMap((row) => {
      const draft = draftCache.get(row.draftPackId);
      return draft && draft.success && Array.isArray(draft.pack && draft.pack.sourceFiles)
        ? draft.pack.sourceFiles
        : [];
    })
  ]);

  REVIEWABLE_SECTIONS.forEach((section) => {
    const existing = Array.isArray(pack[section]) ? pack[section] : [];
    const merged = new Map();
    existing.forEach((item) => {
      merged.set(itemDedupKey(section, item), item);
    });
    acceptedRows.filter((row) => row.section === section).forEach((row) => {
      const approvedItem = buildCombinedApprovedItem(row, now);
      merged.set(itemDedupKey(section, approvedItem), approvedItem);
    });
    pack[section] = Array.from(merged.values());
  });

  const metadata = pack.metadata && typeof pack.metadata === 'object' && !Array.isArray(pack.metadata)
    ? pack.metadata
    : {};
  pack.packId = String(pack.packId || context.packId);
  if (!SAFE_PACK_ID_PATTERN.test(pack.packId)) {
    pack.packId = context.packId;
  }
  pack.title = String(pack.title || context.title || 'Combined Knowledge Pack');
  pack.sourceFiles = sourceFiles;
  pack.metadata = {
    ...metadata,
    updatedAt: now,
    combinedApproval: {
      kind: 'aggregated_review',
      reviewBatchKey: context.reviewBatchKey,
      reviewBatchName: context.reviewBatchName,
      sourceDraftPackIds: context.contextPackIds,
      updatedAt: now
    }
  };
  if (!pack.metadata.createdAt) pack.metadata.createdAt = now;
  if (!pack.metadata.createdBy) pack.metadata.createdBy = 'teacher-content-review';

  return pack;
}

function buildCombinedApprovedItem(row, now) {
  const item = cloneValue(row.item);
  item.reviewStatus = 'approved';
  if (!('standards' in item)) {
    item.standards = makeDefaultStandardsMetadata();
  }
  item.approvalSource = {
    draftPackId: row.draftPackId,
    sourcePackName: row.sourcePackName,
    originalSection: row.section,
    originalIndex: row.resolvedIndex,
    acceptedAt: now
  };
  return item;
}

function dedupeSourceFiles(sourceFiles) {
  const seen = new Set();
  return (Array.isArray(sourceFiles) ? sourceFiles : []).filter((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const key = [
      normalizeComparableString(entry.originalFileName),
      normalizeComparableString(entry.fileName),
      normalizeComparableString(entry.storedFileName)
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function itemDedupKey(section, item) {
  const normalized = normalizeComparableString(getSectionIdentityValue(section, item));
  if (normalized) return `${section}:${normalized}`;
  return `${section}:${normalizeComparableString(JSON.stringify(item || {}))}`;
}

function getSectionIdentityValue(section, item = {}) {
  if (section === 'vocabulary') return item.term || item.title || item.itemId;
  if (section === 'concepts') return item.title || item.conceptId || item.itemId;
  if (section === 'referenceFormulas') return item.title || item.formulaId || item.equation || item.itemId;
  if (section === 'problemBank') return item.question || item.problemId || item.itemId;
  if (section === 'standardsMap') return item.standardId || item.description || item.itemId;
  if (section === 'smokeTests') return item.question || item.expectedRoute || item.itemId;
  return item.itemId || '';
}

function buildAcceptedTargetsByPack(acceptedRows) {
  const byPack = new Map();
  acceptedRows.forEach((row) => {
    if (!byPack.has(row.draftPackId)) byPack.set(row.draftPackId, new Map());
    const sectionMap = byPack.get(row.draftPackId);
    if (!sectionMap.has(row.section)) sectionMap.set(row.section, new Set());
    sectionMap.get(row.section).add(row.resolvedIndex);
  });
  return byPack;
}

function removeAcceptedRowsFromDraftPack(pack, sectionsMap) {
  if (!pack || typeof pack !== 'object' || !sectionsMap) return false;
  let removed = false;
  sectionsMap.forEach((indexSet, section) => {
    const items = Array.isArray(pack[section]) ? pack[section] : [];
    if (!items.length || !indexSet.size) return;
    const indexes = Array.from(indexSet).filter((index) => Number.isInteger(index) && index >= 0).sort((left, right) => right - left);
    indexes.forEach((index) => {
      if (index >= 0 && index < items.length) {
        items.splice(index, 1);
        removed = true;
      }
    });
    pack[section] = items;
  });
  return removed;
}

function countVisibleDraftRows(pack) {
  return REVIEWABLE_SECTIONS.reduce((sum, section) => {
    const items = Array.isArray(pack && pack[section]) ? pack[section] : [];
    const visibleCount = items.filter((item) => normalizeReviewStatus(item && item.reviewStatus) !== 'rejected').length;
    return sum + visibleCount;
  }, 0);
}

function isPendingReviewStatus(status) {
  return status === 'pending' || status === 'needs_review' || status === 'needs-review';
}

function normalizeReviewStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function getApprovedItemPromotionBlockers(section, item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ['Draft item is not valid for approval.'];
  const blockers = [];
  if (!nonEmptyString(item.sourceFile)) blockers.push('sourceFile is required before approval.');
  if (!nonEmptyString(item.sourceLocation)) blockers.push('sourceLocation is required before approval.');
  if (!nonEmptyString(item.sourceTextSnippet)) blockers.push('sourceTextSnippet is required before approval.');
  if (!hasIdentifier(item)) blockers.push('Missing required identifying fields before approval.');

  const unsafeText = [
    item.validationStatus,
    item.repairStatus,
    item.quarantineStatus,
    item.warningStatus,
    item.extractionStatus,
    item.modelStatus,
    item.status,
    ...(Array.isArray(item.validationErrors) ? item.validationErrors : []),
    ...(Array.isArray(item.warnings) ? item.warnings : [])
  ].filter(Boolean).join(' ').toLowerCase();
  if (BLOCKING_STATUS_PATTERN.test(unsafeText)) {
    blockers.push('Rejected, invalid, quarantined, repair-failed, or missing-required-field draft items cannot be approved.');
  }

  const grounding = item.sourceGrounding && typeof item.sourceGrounding === 'object' && !Array.isArray(item.sourceGrounding)
    ? item.sourceGrounding
    : null;
  if (grounding) {
    if (grounding.status !== 'supported') blockers.push('Needs stronger source evidence before promotion.');
    if (grounding.termOrTitleFound === false || grounding.explanationSupported === false) {
      blockers.push('Needs source evidence that matches the item before promotion.');
    }
  }

  if (isLowConfidenceValue(item.confidence) && !hasTeacherLowConfidenceOverride(item)) {
    blockers.push('Needs teacher verification: low confidence.');
  }
  if (section === 'referenceFormulas' && String(item.solverStatus || '').trim() !== 'reference_only') {
    blockers.push('Reference formula must keep solverStatus reference_only.');
  }
  return Array.from(new Set(blockers));
}

function isLowConfidenceOnlyBlockers(blockers) {
  return Array.isArray(blockers)
    && blockers.length > 0
    && blockers.every((blocker) => /teacher verification:\s*low confidence/i.test(String(blocker || '')));
}

function isFinalPublishableDraftItem(section, item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const status = normalizeReviewStatus(item.reviewStatus);
  if (status === 'rejected') return false;
  if (hasExplicitBlockingPublishState(item)) return false;
  return hasUsableDraftItemFieldsForSection(section, item);
}

function hasExplicitBlockingPublishState(item = {}) {
  const unsafeText = [
    item.validationStatus,
    item.repairStatus,
    item.quarantineStatus,
    item.warningStatus,
    item.extractionStatus,
    item.modelStatus,
    item.status,
    ...(Array.isArray(item.validationErrors) ? item.validationErrors : []),
    ...(Array.isArray(item.warnings) ? item.warnings : [])
  ].filter(Boolean).join(' ').toLowerCase();
  return BLOCKING_STATUS_PATTERN.test(unsafeText);
}

function hasUsableDraftItemFieldsForSection(section, item = {}) {
  if (section === 'vocabulary') {
    return nonEmptyString(item.term)
      || nonEmptyString(item.title)
      || nonEmptyString(item.itemId)
      || nonEmptyString(item.studentDefinition)
      || nonEmptyString(item.teacherDefinition);
  }
  if (section === 'concepts') {
    return nonEmptyString(item.conceptId)
      || nonEmptyString(item.title)
      || nonEmptyString(item.itemId)
      || nonEmptyString(item.studentExplanation);
  }
  if (section === 'referenceFormulas') {
    return nonEmptyString(item.formulaId)
      || nonEmptyString(item.title)
      || nonEmptyString(item.equation)
      || nonEmptyString(item.itemId);
  }
  if (section === 'problemBank') {
    return nonEmptyString(item.problemId)
      || nonEmptyString(item.question)
      || nonEmptyString(item.itemId)
      || nonEmptyString(item.expectedAnswer);
  }
  if (section === 'standardsMap') {
    return nonEmptyString(item.standardId)
      || nonEmptyString(item.description)
      || nonEmptyString(item.itemId);
  }
  if (section === 'smokeTests') {
    return nonEmptyString(item.question)
      || nonEmptyString(item.expectedAnswer)
      || nonEmptyString(item.itemId);
  }
  return hasIdentifier(item);
}

function hasIdentifier(item = {}) {
  return nonEmptyString(item.term)
    || nonEmptyString(item.title)
    || nonEmptyString(item.question)
    || nonEmptyString(item.equation)
    || nonEmptyString(item.standardId);
}

function resolvePackFilePath(rootDir, packId) {
  const safePackId = String(packId || '').trim();
  if (!SAFE_PACK_ID_PATTERN.test(safePackId)) {
    throw new Error('packId must contain only lowercase letters, numbers, underscores, and hyphens.');
  }
  const packPath = path.resolve(rootDir, safePackId, KNOWLEDGE_PACK_FILE_NAME);
  const relative = path.relative(rootDir, packPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Pack path is outside the expected teacher-content directory.');
  }
  return packPath;
}

function assertAbsoluteDirectory(directoryPath, label) {
  if (!path.isAbsolute(directoryPath)) {
    throw new Error(`${label} directory must be absolute.`);
  }
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function blocked(message, extras = {}) {
  return {
    success: false,
    errors: [String(message || 'Combined review approval failed.')],
    warnings: [],
    ...extras
  };
}

module.exports = {
  approveCombinedReviewRows
};
