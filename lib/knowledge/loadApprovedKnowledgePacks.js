const fs = require('node:fs');
const path = require('node:path');

const { validateKnowledgePack } = require('./validateKnowledgePack');

const DEFAULT_APPROVED_PACKS_DIR = path.join(__dirname, '..', '..', 'knowledge', 'approved-packs');

function loadApprovedKnowledgePacks(options = {}) {
  const approvedPacksDir = options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR;
  const packFilePaths = findKnowledgePackFiles(approvedPacksDir);
  const packs = [];
  const errors = [];

  packFilePaths.forEach((sourcePath) => {
    let parsed;

    try {
      parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    } catch (error) {
      errors.push({
        sourcePath,
        errors: [`Could not read or parse JSON file: ${error.message}`],
        warnings: []
      });
      return;
    }

    const validation = validateKnowledgePack(parsed, options.validationOptions || {});
    if (!validation.valid) {
      errors.push({
        sourcePath,
        packId: parsed && parsed.packId,
        title: parsed && parsed.title,
        errors: validation.errors,
        warnings: validation.warnings
      });
      return;
    }

    packs.push({
      pack: parsed,
      packId: parsed.packId,
      title: parsed.title,
      version: parsed.version,
      subject: parsed.subject,
      gradeLevel: parsed.gradeLevel,
      sourcePath,
      warnings: validation.warnings
    });
  });

  return {
    approvedPacksDir,
    packs,
    errors
  };
}

function findKnowledgePackFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  walk(rootDir, results);
  return results.sort();
}

function walk(currentPath, results) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  entries.forEach((entry) => {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath, results);
      return;
    }

    if (entry.isFile() && entry.name === 'knowledge_pack.json') {
      results.push(entryPath);
    }
  });
}

module.exports = {
  DEFAULT_APPROVED_PACKS_DIR,
  findKnowledgePackFiles,
  loadApprovedKnowledgePacks
};
