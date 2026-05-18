const fs = require('node:fs');
const path = require('node:path');

const { removeApprovedPackActivation } = require('./approvedPackActivationStore');
const { DEFAULT_APPROVED_PACKS_DIR, loadApprovedKnowledgePacks } = require('./loadApprovedKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';

function deleteApprovedKnowledgePack(packId, options = {}) {
  const safePackId = String(packId || '').trim();
  assertSafePackId(safePackId);

  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir,
    validationOptions: options.validationOptions || {}
  });
  const record = approved.packs.find((packRecord) => packRecord.packId === safePackId);
  if (!record) {
    const error = new Error('Approved pack not found.');
    error.statusCode = 404;
    throw error;
  }

  assertConfirmed(record, options);

  const packFilePath = path.resolve(record.sourcePath);
  const packDir = path.dirname(packFilePath);
  assertApprovedPackPath({ packDir, packFilePath, approvedPacksDir });

  const deletedApprovedPacksDir = path.resolve(
    options.deletedApprovedPacksDir || path.join(path.dirname(approvedPacksDir), 'deleted-approved-packs')
  );
  assertArchivePath({ deletedApprovedPacksDir, approvedPacksDir });
  fs.mkdirSync(deletedApprovedPacksDir, { recursive: true });

  const archivedPath = makeUniqueArchivePath(deletedApprovedPacksDir, safePackId, options.deletedAt);
  fs.renameSync(packDir, archivedPath);
  const activationRemoval = removeApprovedPackActivation(safePackId, { approvedPacksDir });

  return {
    success: true,
    packId: safePackId,
    title: record.title,
    archivedPath,
    removedActivation: activationRemoval.removed === true,
    sourceFilesPreserved: true,
    draftPacksPreserved: true
  };
}

function assertConfirmed(record, options = {}) {
  const confirmationText = String(options.confirmationText || '').trim();
  const accepted = new Set(['DELETE', record.title, record.packId].filter(Boolean));
  if (!accepted.has(confirmationText)) {
    const error = new Error('Delete confirmation must exactly match DELETE, the pack title, or the pack ID.');
    error.statusCode = 400;
    throw error;
  }
}

function assertApprovedPackPath({ packDir, packFilePath, approvedPacksDir }) {
  if (path.basename(packFilePath) !== KNOWLEDGE_PACK_FILE_NAME) {
    throw makeUnsafePathError();
  }

  const relativePackDir = path.relative(approvedPacksDir, packDir);
  const relativePackFile = path.relative(approvedPacksDir, packFilePath);
  if (
    !relativePackDir
    || relativePackDir.startsWith('..')
    || path.isAbsolute(relativePackDir)
    || relativePackFile.startsWith('..')
    || path.isAbsolute(relativePackFile)
  ) {
    throw makeUnsafePathError();
  }
}

function assertArchivePath({ deletedApprovedPacksDir, approvedPacksDir }) {
  const relativeArchiveRoot = path.relative(approvedPacksDir, deletedApprovedPacksDir);
  if (!relativeArchiveRoot || (!relativeArchiveRoot.startsWith('..') && !path.isAbsolute(relativeArchiveRoot))) {
    const error = new Error('Deleted approved packs archive must be outside the approved packs directory.');
    error.statusCode = 400;
    throw error;
  }
}

function makeUniqueArchivePath(deletedApprovedPacksDir, packId, deletedAt) {
  const timestamp = sanitizeTimestamp(deletedAt || new Date().toISOString());
  const basePath = path.join(deletedApprovedPacksDir, `${timestamp}-${packId}`);
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
  const error = new Error('Approved pack path is outside the approved packs directory.');
  error.statusCode = 400;
  return error;
}

module.exports = {
  deleteApprovedKnowledgePack
};
