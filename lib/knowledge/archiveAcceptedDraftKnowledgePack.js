const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_APPROVED_PACKS_DIR,
  findKnowledgePackFiles: findApprovedKnowledgePackFiles,
  loadApprovedKnowledgePacks
} = require('./loadApprovedKnowledgePacks');
const {
  DEFAULT_DRAFT_PACKS_DIR,
  findKnowledgePackFiles: findDraftKnowledgePackFiles
} = require('./loadDraftKnowledgePacks');
const { matchApprovedRecordForDraft } = require('./matchDraftApprovedPacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';

function archiveAcceptedDraftKnowledgePack(packId, options = {}) {
  const safePackId = String(packId || '').trim();
  assertSafePackId(safePackId);

  const draftPacksDir = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  const draftRecord = findDraftPackRecord(safePackId, draftPacksDir);
  const approvedRecord = findApprovedPackRecord(safePackId, approvedPacksDir, options, draftRecord);
  if (!approvedRecord) {
    const error = new Error('Accepted draft copy can only be archived after an approved pack exists.');
    error.statusCode = 409;
    throw error;
  }
  if (!draftRecord) {
    return {
      success: true,
      packId: safePackId,
      title: approvedRecord.title,
      alreadyArchived: true,
      archivedPath: '',
      approvedPackPreserved: true
    };
  }

  const packFilePath = path.resolve(draftRecord.sourcePath);
  const packDir = path.dirname(packFilePath);
  assertDraftPackPath({ packDir, packFilePath, draftPacksDir });

  const acceptedDraftPacksDir = path.resolve(options.acceptedDraftPacksDir || path.join(draftPacksDir, '_accepted'));
  assertArchivePath({ acceptedDraftPacksDir, draftPacksDir });
  fs.mkdirSync(acceptedDraftPacksDir, { recursive: true });

  const archivedPath = makeUniqueArchivePath(acceptedDraftPacksDir, safePackId, options.archivedAt);
  fs.renameSync(packDir, archivedPath);

  return {
    success: true,
    packId: safePackId,
    title: draftRecord.title || approvedRecord.title,
    archivedPath,
    alreadyArchived: false,
    approvedPackPreserved: true
  };
}

function archiveDraftKnowledgePackFromReviewQueue(packId, options = {}) {
  const safePackId = String(packId || '').trim();
  assertSafePackId(safePackId);

  const draftPacksDir = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  const approvedRecord = findApprovedPackRecord(safePackId, approvedPacksDir, options);
  const draftRecord = findDraftPackRecord(safePackId, draftPacksDir);
  if (!draftRecord) {
    return {
      success: true,
      packId: safePackId,
      title: approvedRecord?.title || safePackId,
      alreadyArchived: true,
      archivedPath: '',
      approvedPackPreserved: Boolean(approvedRecord),
      removedFromReviewQueue: true
    };
  }

  const packFilePath = path.resolve(draftRecord.sourcePath);
  const packDir = path.dirname(packFilePath);
  assertDraftPackPath({ packDir, packFilePath, draftPacksDir });

  const removedDraftPacksDir = path.resolve(options.removedDraftPacksDir || path.join(draftPacksDir, '_removed'));
  assertArchivePath({ acceptedDraftPacksDir: removedDraftPacksDir, draftPacksDir });
  fs.mkdirSync(removedDraftPacksDir, { recursive: true });

  const archivedPath = makeUniqueArchivePath(removedDraftPacksDir, safePackId, options.archivedAt);
  fs.renameSync(packDir, archivedPath);

  return {
    success: true,
    packId: safePackId,
    title: draftRecord.title || approvedRecord?.title || safePackId,
    archivedPath,
    alreadyArchived: false,
    approvedPackPreserved: Boolean(approvedRecord),
    removedFromReviewQueue: true
  };
}

function findApprovedPackRecord(packId, approvedPacksDir, options = {}, draftRecord = null) {
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir,
    validationOptions: options.validationOptions || {}
  });
  const approvedRecord = approved.packs.find((record) => record.packId === packId);
  if (approvedRecord) return approvedRecord;

  const matches = [];
  findApprovedKnowledgePackFiles(approvedPacksDir).forEach((sourcePath) => {
    try {
      const pack = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      if (pack && pack.packId === packId) {
        matches.push({
          sourcePath,
          packId: pack.packId,
          title: pack.title || pack.packId || ''
        });
      }
    } catch (_error) {
      // Invalid JSON cannot prove an approved counterpart for this packId.
    }
  });
  if (matches.length > 1) {
    const error = new Error(`Multiple approved packs found for packId ${packId}; remove the draft copy manually.`);
    error.statusCode = 409;
    throw error;
  }
  if (matches.length === 1) return matches[0];

  if (draftRecord) {
    const matched = matchApprovedRecordForDraft(draftRecord, approved.packs);
    if (matched && matched.record) return matched.record;
  }
  return null;
}

function findDraftPackRecord(packId, draftPacksDir) {
  const matches = [];
  findDraftKnowledgePackFiles(draftPacksDir).forEach((sourcePath) => {
    try {
      const pack = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      if (pack && pack.packId === packId) {
        matches.push({
          sourcePath,
          pack,
          packId: pack.packId,
          title: pack.title || pack.packId || ''
        });
      }
    } catch (_error) {
      // Invalid draft files are handled by the normal draft loader; archive only exact valid matches.
    }
  });
  if (!matches.length) return null;
  if (matches.length > 1) {
    const error = new Error(`Multiple active draft copies found for packId ${packId}; archive manually.`);
    error.statusCode = 409;
    throw error;
  }
  return matches[0];
}

function assertDraftPackPath({ packDir, packFilePath, draftPacksDir }) {
  if (path.basename(packFilePath) !== KNOWLEDGE_PACK_FILE_NAME) {
    throw makeUnsafePathError();
  }
  const relativePackDir = path.relative(draftPacksDir, packDir);
  const relativePackFile = path.relative(draftPacksDir, packFilePath);
  if (
    !relativePackDir
    || relativePackDir.startsWith('..')
    || path.isAbsolute(relativePackDir)
    || relativePackFile.startsWith('..')
    || path.isAbsolute(relativePackFile)
    || relativePackDir.split(path.sep).some((part) => part.startsWith('_'))
  ) {
    throw makeUnsafePathError();
  }
}

function assertArchivePath({ acceptedDraftPacksDir, draftPacksDir }) {
  const relativeArchiveRoot = path.relative(draftPacksDir, acceptedDraftPacksDir);
  if (
    !relativeArchiveRoot
    || relativeArchiveRoot.startsWith('..')
    || path.isAbsolute(relativeArchiveRoot)
    || !relativeArchiveRoot.split(path.sep)[0].startsWith('_')
  ) {
    const error = new Error('Accepted draft archive must be inside an underscore-prefixed draft-packs archive directory.');
    error.statusCode = 400;
    throw error;
  }
}

function makeUniqueArchivePath(acceptedDraftPacksDir, packId, archivedAt) {
  const timestamp = sanitizeTimestamp(archivedAt || new Date().toISOString());
  const basePath = path.join(acceptedDraftPacksDir, `${timestamp}-${packId}`);
  let candidate = basePath;
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = `${basePath}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function sanitizeTimestamp(value) {
  return String(value || new Date().toISOString())
    .replace(/[^0-9A-Za-z_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function assertSafePackId(packId) {
  if (!SAFE_PACK_ID_PATTERN.test(packId)) {
    const error = new Error('packId must contain only lowercase letters, numbers, underscores, and hyphens.');
    error.statusCode = 400;
    throw error;
  }
}

function makeUnsafePathError() {
  const error = new Error('Draft pack path is outside the active draft packs directory.');
  error.statusCode = 400;
  return error;
}

module.exports = {
  archiveAcceptedDraftKnowledgePack,
  archiveDraftKnowledgePackFromReviewQueue
};
