const fs = require('node:fs');
const path = require('node:path');

const { removeApprovedPackActivation } = require('./approvedPackActivationStore');
const { DEFAULT_APPROVED_PACKS_DIR } = require('./loadApprovedKnowledgePacks');
const { DEFAULT_DRAFT_PACKS_DIR } = require('./loadDraftKnowledgePacks');
const { SAFE_PACK_ID_PATTERN } = require('./packSchema');

const KNOWLEDGE_PACK_FILE_NAME = 'knowledge_pack.json';
const SAFE_PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

function deleteApprovedKnowledgePack(packId, options = {}) {
  const safePackId = String(packId || '').trim();
  assertSafePackId(safePackId);

  const roots = resolveDeletionRoots(options);
  const matches = findAllMatchingPackDirectories(safePackId, roots);
  const notFound = matches.length ? [] : [safePackId];
  const deleted = [];
  const errors = [];
  const deletedLocations = [];

  assertConfirmed(matches, options);

  matches.forEach((match) => {
    try {
      fs.rmSync(match.packDir, { recursive: true, force: false });
      const displayPath = normalizeDisplayPath(match.packDir);
      deleted.push(displayPath);
      deletedLocations.push({
        location: match.location,
        sourcePath: match.packDir,
        action: 'deleted',
        archivedPath: ''
      });
    } catch (error) {
      errors.push(`Failed to delete ${match.packDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  if (!deleted.length) {
    return {
      success: false,
      packId: safePackId,
      deleted,
      notFound,
      errors: errors.length ? errors : ['No matching saved knowledge pack directories were deleted.'],
      deletedCount: 0,
      deletedLocations: [],
      removedActivation: false
    };
  }

  const activationRemoval = removeApprovedPackActivation(safePackId, { approvedPacksDir: roots.approvedPacksDir });
  const title = matches.find((match) => match.title)?.title || safePackId;

  return {
    success: true,
    packId: safePackId,
    title,
    deleted,
    notFound,
    errors,
    deletedCount: deletedLocations.length,
    approvedArchivedCount: 0,
    draftDeletedCount: deletedLocations.filter((entry) => entry.location === 'draft-packs').length,
    archivedDraftDeletedCount: 0,
    deletedLocations,
    archivedPath: '',
    removedActivation: activationRemoval.removed === true,
    sourceFilesPreserved: true,
    notDeletedDueToErrorCount: errors.length
  };
}

function deleteApprovedKnowledgePacks(packIds, options = {}) {
  const safePackIds = normalizeBulkPackIds(packIds);
  const roots = resolveDeletionRoots(options);
  const foundByPackId = new Map();
  safePackIds.forEach((packId) => {
    foundByPackId.set(packId, findAllMatchingPackDirectories(packId, roots));
  });
  const missingPackId = safePackIds.find((packId) => (foundByPackId.get(packId) || []).length === 0);
  if (missingPackId) {
    const error = new Error(`Knowledge pack not found: ${missingPackId}`);
    error.statusCode = 404;
    throw error;
  }

  assertBulkConfirmed(safePackIds, options);

  const deletedAt = options.deletedAt || new Date().toISOString();
  const deletions = safePackIds.map((packId) => deleteApprovedKnowledgePack(packId, {
    ...options,
    approvedPacksDir: roots.approvedPacksDir,
    draftPacksDir: roots.draftPacksDir,
    acceptedDraftPacksDir: roots.acceptedDraftPacksDir,
    removedDraftPacksDir: roots.removedDraftPacksDir,
    deletedApprovedPacksDir: roots.deletedApprovedPacksDir,
    confirmationText: 'DELETE',
    deletedAt
  }));

  return {
    success: true,
    deletedCount: deletions.length,
    deletedPackIds: deletions.map((deletion) => deletion.packId),
    deletions,
    sourceFilesPreserved: true
  };
}

function resolveDeletionRoots(options = {}) {
  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  const draftPacksDir = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);

  assertRootPath('approved-packs', approvedPacksDir);
  assertRootPath('draft-packs', draftPacksDir);

  return {
    approvedPacksDir,
    draftPacksDir
  };
}

function assertConfirmed(matches, options = {}) {
  if (options.confirmed === true) return;
  const confirmationText = String(options.confirmationText || '').trim();
  const accepted = new Set([
    'DELETE',
    ...matches.map((match) => match.title).filter(Boolean),
    ...matches.map((match) => match.packId).filter(Boolean)
  ]);
  if (!accepted.has(confirmationText)) {
    const error = new Error('Delete confirmation must exactly match DELETE, the visible pack title, or the pack ID.');
    error.statusCode = 400;
    throw error;
  }
}

function assertBulkConfirmed(packIds, options = {}) {
  if (options.confirmed === true) {
    if (!packIds.length) {
      const error = new Error('At least one visible knowledge pack ID is required for bulk delete.');
      error.statusCode = 400;
      throw error;
    }
    return;
  }
  const confirmationText = String(options.confirmationText || '').trim();
  if (confirmationText !== 'DELETE') {
    const error = new Error('Bulk delete confirmation must exactly match DELETE.');
    error.statusCode = 400;
    throw error;
  }
  if (!packIds.length) {
    const error = new Error('At least one visible knowledge pack ID is required for bulk delete.');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeBulkPackIds(packIds) {
  if (!Array.isArray(packIds) || !packIds.length) {
    const error = new Error('packIds must include at least one visible knowledge pack ID.');
    error.statusCode = 400;
    throw error;
  }

  const seen = new Set();
  return packIds.map((packId) => String(packId || '').trim()).filter((packId) => {
    assertSafePackId(packId);
    if (seen.has(packId)) return false;
    seen.add(packId);
    return true;
  });
}

function findAllMatchingPackDirectories(packId, roots) {
  const results = [];
  const seen = new Set();
  const scanners = [
    { location: 'approved-packs', rootDir: roots.approvedPacksDir, skipUnderscoreDirs: true },
    { location: 'draft-packs', rootDir: roots.draftPacksDir, skipUnderscoreDirs: true }
  ];

  scanners.forEach((scanner) => {
    findKnowledgePackFiles(scanner.rootDir, { skipUnderscoreDirs: scanner.skipUnderscoreDirs }).forEach((packFilePath) => {
      const parsed = tryParsePack(packFilePath);
      if (!parsed || parsed.packId !== packId) return;

      const packDir = path.dirname(path.resolve(packFilePath));
      if (seen.has(packDir)) return;
      assertPackDirectoryPath({ packDir, packFilePath, rootDir: scanner.rootDir });
      results.push({
        location: scanner.location,
        rootDir: scanner.rootDir,
        packFilePath: path.resolve(packFilePath),
        packDir,
        packId: parsed.packId,
        title: parsed.title || parsed.packId || ''
      });
      seen.add(packDir);
    });
  });

  scanners.forEach((scanner) => {
    if (!fs.existsSync(scanner.rootDir)) return;
    const entries = fs.readdirSync(scanner.rootDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isDirectory() || entry.isSymbolicLink()) return;
      if (scanner.skipUnderscoreDirs && entry.name.startsWith('_')) return;
      if (entry.name !== packId) return;
      const packDir = path.join(scanner.rootDir, entry.name);
      const packFilePath = path.join(packDir, KNOWLEDGE_PACK_FILE_NAME);
      if (fs.existsSync(packFilePath)) return;
      if (seen.has(packDir)) return;
      assertSafePathSegment(entry.name);
      results.push({
        location: scanner.location,
        rootDir: scanner.rootDir,
        packFilePath: '',
        packDir: path.resolve(packDir),
        packId,
        title: packId
      });
      seen.add(packDir);
    });
  });

  return results;
}

function assertRootPath(label, directoryPath) {
  if (!directoryPath || !path.isAbsolute(directoryPath)) {
    const error = new Error(`${label} directory must be an absolute path.`);
    error.statusCode = 400;
    throw error;
  }
}


function assertPackDirectoryPath({ packDir, packFilePath, rootDir }) {
  if (path.basename(packFilePath) !== KNOWLEDGE_PACK_FILE_NAME) throw makeUnsafePathError();
  const relativePackDir = path.relative(rootDir, packDir);
  const relativePackFile = path.relative(rootDir, packFilePath);
  if (
    !relativePackDir
    || relativePackDir.startsWith('..')
    || path.isAbsolute(relativePackDir)
    || relativePackFile.startsWith('..')
    || path.isAbsolute(relativePackFile)
  ) {
    throw makeUnsafePathError();
  }
  relativePackDir.split(path.sep).forEach(assertSafePathSegment);
}

function assertSafePathSegment(segment) {
  if (!segment || segment === '.' || segment === '..' || !SAFE_PATH_SEGMENT_PATTERN.test(segment)) {
    throw makeUnsafePathError();
  }
}

function findKnowledgePackFiles(rootDir, options = {}) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  walk(rootDir, files, options);
  return files.sort();
}

function walk(currentPath, files, options) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isSymbolicLink()) return;
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (options.skipUnderscoreDirs && entry.name.startsWith('_')) return;
      walk(entryPath, files, options);
      return;
    }
    if (entry.isFile() && entry.name === KNOWLEDGE_PACK_FILE_NAME) {
      files.push(entryPath);
    }
  });
}

function tryParsePack(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function normalizeDisplayPath(absPath) {
  const relative = path.relative(process.cwd(), absPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return absPath;
  return relative.split(path.sep).join('/');
}

function assertSafePackId(packId) {
  if (!SAFE_PACK_ID_PATTERN.test(packId)) {
    const error = new Error('packId must contain only lowercase letters, numbers, underscores, and hyphens.');
    error.statusCode = 400;
    throw error;
  }
}

function makeUnsafePathError() {
  const error = new Error('Knowledge pack path is outside allowed teacher-content pack directories.');
  error.statusCode = 400;
  return error;
}

module.exports = {
  deleteApprovedKnowledgePack,
  deleteApprovedKnowledgePacks
};
