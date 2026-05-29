function matchApprovedRecordForDraft(draftRecord, approvedRecords = []) {
  if (!draftRecord || !draftRecord.pack || !Array.isArray(approvedRecords) || !approvedRecords.length) return null;

  const draftPackId = String(draftRecord.packId || draftRecord.pack.packId || '').trim();
  const draftPack = draftRecord.pack;
  const exactPackIdMatch = approvedRecords.find((record) => String(record && record.packId || '').trim() === draftPackId) || null;
  if (exactPackIdMatch) {
    return { record: exactPackIdMatch, reason: 'packId' };
  }

  const sourceMatch = findSourceMetadataMatch(draftPackId, draftPack, approvedRecords);
  if (sourceMatch) return sourceMatch;

  const titleMatch = findNormalizedTitleFallbackMatch(draftPack, approvedRecords);
  if (titleMatch) return titleMatch;

  return null;
}

function findSourceMetadataMatch(draftPackId, draftPack, approvedRecords) {
  const draftUploadIds = collectPackUploadIds(draftPack);
  const draftSourceFileNames = collectPackSourceFileNames(draftPack);
  const candidates = approvedRecords.filter((record) => {
    const approvedPack = record && record.pack;
    if (!approvedPack || typeof approvedPack !== 'object' || Array.isArray(approvedPack)) return false;

    const combinedSourceDraftPackIds = collectCombinedSourceDraftPackIds(approvedPack);
    if (draftPackId && combinedSourceDraftPackIds.has(draftPackId)) return true;

    const approvedUploadIds = collectPackUploadIds(approvedPack);
    if (hasAnyOverlap(draftUploadIds, approvedUploadIds)) return true;
    const approvedSourceFileNames = collectPackSourceFileNames(approvedPack);
    if (canFallbackToSourceFileNames(draftUploadIds, approvedUploadIds) && hasAnyOverlap(draftSourceFileNames, approvedSourceFileNames)) {
      return true;
    }

    return false;
  });

  if (candidates.length !== 1) return null;
  return { record: candidates[0], reason: 'source' };
}

function findNormalizedTitleFallbackMatch(draftPack, approvedRecords) {
  const normalizedDraftTitle = normalizeComparableString(draftPack && draftPack.title);
  if (!normalizedDraftTitle) return null;
  if (hasStrongSourceMetadata(draftPack)) return null;

  const candidates = approvedRecords.filter((record) => {
    const approvedPack = record && record.pack;
    if (!approvedPack || typeof approvedPack !== 'object' || Array.isArray(approvedPack)) return false;
    if (hasStrongSourceMetadata(approvedPack)) return false;
    return normalizeComparableString(approvedPack.title) === normalizedDraftTitle;
  });

  if (candidates.length !== 1) return null;
  return { record: candidates[0], reason: 'title' };
}

function hasStrongSourceMetadata(pack) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return false;
  return collectPackUploadIds(pack).size > 0 || collectPackSourceFileNames(pack).size > 0;
}

function collectPackUploadIds(pack) {
  const ids = new Set();
  const metadata = pack && pack.metadata && typeof pack.metadata === 'object' && !Array.isArray(pack.metadata)
    ? pack.metadata
    : {};
  const sourceUpload = metadata.sourceUpload && typeof metadata.sourceUpload === 'object' && !Array.isArray(metadata.sourceUpload)
    ? metadata.sourceUpload
    : {};

  const sourceUploadId = normalizeComparableString(sourceUpload.uploadId);
  if (sourceUploadId) ids.add(sourceUploadId);

  const sourceFiles = Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : [];
  sourceFiles.forEach((sourceFile) => {
    const uploadId = normalizeComparableString(sourceFile && sourceFile.uploadId);
    if (uploadId) ids.add(uploadId);
  });

  return ids;
}

function collectPackSourceFileNames(pack) {
  const names = new Set();
  const sourceFiles = Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : [];
  sourceFiles.forEach((sourceFile) => {
    const normalized = normalizeComparableString(
      sourceFile && (
        sourceFile.originalFileName
        || sourceFile.fileName
        || sourceFile.storedFileName
      )
    );
    if (normalized) names.add(normalized);
  });
  return names;
}

function collectCombinedSourceDraftPackIds(pack) {
  const ids = new Set();
  const metadata = pack && pack.metadata && typeof pack.metadata === 'object' && !Array.isArray(pack.metadata)
    ? pack.metadata
    : {};
  const combined = metadata.combinedApproval && typeof metadata.combinedApproval === 'object' && !Array.isArray(metadata.combinedApproval)
    ? metadata.combinedApproval
    : {};
  const sourceDraftPackIds = Array.isArray(combined.sourceDraftPackIds) ? combined.sourceDraftPackIds : [];
  sourceDraftPackIds.forEach((packId) => {
    const normalized = normalizeComparableString(packId);
    if (normalized) ids.add(normalized);
  });
  return ids;
}

function hasAnyOverlap(leftSet, rightSet) {
  if (!leftSet || !rightSet || !leftSet.size || !rightSet.size) return false;
  for (const value of leftSet) {
    if (rightSet.has(value)) return true;
  }
  return false;
}

function canFallbackToSourceFileNames(leftUploadIds, rightUploadIds) {
  const leftHasUploadIds = Boolean(leftUploadIds && leftUploadIds.size);
  const rightHasUploadIds = Boolean(rightUploadIds && rightUploadIds.size);
  return leftHasUploadIds !== rightHasUploadIds;
}

function normalizeComparableString(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

module.exports = {
  collectCombinedSourceDraftPackIds,
  collectPackSourceFileNames,
  collectPackUploadIds,
  hasStrongSourceMetadata,
  matchApprovedRecordForDraft,
  normalizeComparableString
};
