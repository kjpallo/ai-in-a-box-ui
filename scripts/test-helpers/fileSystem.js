const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..', '..');

function makeTempRoot(prefix, options = {}) {
  if (options.insideProject) {
    return path.join(projectRoot, 'tmp', prefix);
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function ensureDirs(...dirs) {
  dirs.forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function writeKnowledgePack(rootDir, pack) {
  return writeJsonFile(path.join(rootDir, pack.packId, 'knowledge_pack.json'), pack);
}

function readKnowledgePack(rootDir, packId) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, packId, 'knowledge_pack.json'), 'utf8'));
}

function writeStandardsBank(rootDir, bank) {
  return writeJsonFile(path.join(rootDir, bank.standardsBankId, 'standards_bank.json'), bank);
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  });
  return results.sort();
}

function snapshotTextFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function snapshotKnowledgePackFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).filter((filePath) => path.basename(filePath) === 'knowledge_pack.json').forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function snapshotFileStats(rootDir, predicate) {
  const snapshot = {};
  walkFiles(rootDir).filter((filePath) => predicate(path.relative(rootDir, filePath), filePath)).forEach((filePath) => {
    const stat = fs.statSync(filePath);
    snapshot[path.relative(rootDir, filePath)] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
  });
  return snapshot;
}

module.exports = {
  cleanupDir,
  ensureDirs,
  makeTempRoot,
  projectRoot,
  readKnowledgePack,
  snapshotFileStats,
  snapshotKnowledgePackFiles,
  snapshotTextFiles,
  walkFiles,
  writeJsonFile,
  writeKnowledgePack,
  writeStandardsBank
};
