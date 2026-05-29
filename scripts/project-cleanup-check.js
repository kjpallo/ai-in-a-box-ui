#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const LARGE_FILE_BYTES = Number(process.env.CLEANUP_LARGE_FILE_BYTES || 5 * 1024 * 1024);
const TOP_FILE_LIMIT = Number(process.env.CLEANUP_TOP_FILE_LIMIT || 20);
const SUSPICIOUS_LIST_LIMIT = Number(process.env.CLEANUP_SUSPICIOUS_LIST_LIMIT || 50);
const DUP_MAX_FILES = Number(process.env.CLEANUP_DUP_MAX_FILES || 2000);
const DUP_MAX_TOTAL_BYTES = Number(process.env.CLEANUP_DUP_MAX_TOTAL_BYTES || 1 * 1024 * 1024 * 1024);
const DUP_MAX_FILE_BYTES = Number(process.env.CLEANUP_DUP_MAX_FILE_BYTES || 200 * 1024 * 1024);

const WALK_SKIP_DIRS = new Set(['.git', 'node_modules']);
const SOURCE_SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'vendor', 'backups', 'tmp', 'logs', 'audio', 'models', 'voices', 'uploads']);
const SOURCE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
  '.css', '.scss', '.html', '.md',
  '.json', '.yaml', '.yml', '.sh', '.py'
]);

const REVIEW_SAFETY_RULES = [
  { name: '.git', gitignore: [/^\.git\/?$/m], zip: [/\.git\/\*/] },
  { name: 'node_modules', gitignore: [/^node_modules\/?$/m], zip: [/node_modules\/\*/] },
  { name: '.env and .env.*', gitignore: [/^\.env$/m, /^\.env\.\*$/m], zip: [/\.env/, /\.env\.\*/] },
  { name: 'logs', gitignore: [/^logs\/?$/m], zip: [/logs\/\*/] },
  { name: 'audio', gitignore: [/^audio\/\*$/m], zip: [/audio\/\*/] },
  { name: 'voices/*.onnx', gitignore: [/^voices\/\*\.onnx$/m], zip: [/voices\/\*\.onnx/] },
  { name: 'voices/*.json', gitignore: [/^voices\/\*\.json$/m], zip: [/voices\/\*\.json/] },
  { name: 'models', gitignore: [/^models\/?$/m], zip: [/models\/\*/] },
  { name: 'vendor', gitignore: [/^vendor\/?$/m], zip: [/vendor\/\*/] },
  { name: 'backups', gitignore: [/^backups\/?$/m], zip: [/backups\/\*/] },
  { name: 'tmp', gitignore: [/^tmp\/?$/m], zip: [/tmp\/\*/] },
  { name: 'knowledge/uploads/incoming', gitignore: [/^knowledge\/uploads\/incoming\/\*$/m], zip: [/knowledge\/uploads\/incoming\/\*/] },
  { name: 'knowledge/uploads/extracted', gitignore: [/^knowledge\/uploads\/extracted\/\*$/m], zip: [/knowledge\/uploads\/extracted\/\*/] },
  { name: 'knowledge/uploads/page-images', gitignore: [/^knowledge\/uploads\/page-images\/\*$/m], zip: [/knowledge\/uploads\/page-images\/\*/] },
  { name: 'knowledge/uploads/ocr', gitignore: [/^knowledge\/uploads\/ocr\/\*$/m], zip: [/knowledge\/uploads\/ocr\/\*/] },
  { name: 'token/auth/secret/gmail/teacher-auth signals', gitignore: [/\*oauth\*\.json/, /\*gmail\*auth\*\.json/, /\*teacher\*auth\*\.json/], zip: [/\*oauth\*/, /\*gmail[_*]?auth\*/, /\*teacher[_*]?auth\*/] }
];

const SUSPICIOUS_PATH_PATTERNS = [
  /(^|\/)\.env($|[.])/i,
  /(^|\/)logs\//i,
  /(^|\/)audio\//i,
  /(^|\/)models\//i,
  /(^|\/)vendor\//i,
  /(^|\/)backups\//i,
  /(^|\/)tmp\//i,
  /(^|\/)knowledge\/uploads\/(incoming|extracted|page-images|ocr)\//i,
  /(^|\/)voices\/[^/]*\.(onnx|json)$/i,
  /(^|\/)[^/]*(token|secret|oauth|gmail[_-]?auth|teacher[_-]?auth)[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$/i,
  /(^|\/)[^/]*auth[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$/i,
  /(^|\/)[^/]*\.(pem|key|p12|pfx)$/i
];

const UPLOAD_DIRS = [
  'knowledge/uploads/incoming',
  'knowledge/uploads/extracted',
  'knowledge/uploads/page-images',
  'knowledge/uploads/ocr'
];

function toRelative(filePath) {
  return path.relative(projectDir, filePath).split(path.sep).join('/');
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function walkFiles(startDir, options = {}) {
  const skipDirs = options.skipDirs || new Set();
  const files = [];

  function walk(currentDir) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const stat = fs.statSync(fullPath);
        files.push({ path: fullPath, rel: toRelative(fullPath), size: stat.size });
      } catch {
        // Ignore files that disappear during scan.
      }
    }
  }

  walk(startDir);
  return files;
}

function countLinesSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (!text.length) return 0;
    return text.split(/\r?\n/).length;
  } catch {
    return null;
  }
}

function isSourceFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function isSuspiciousPath(relPath) {
  return SUSPICIOUS_PATH_PATTERNS.some((pattern) => pattern.test(relPath));
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function findDuplicateUploadArtifacts() {
  const uploadFiles = [];
  for (const relDir of UPLOAD_DIRS) {
    const absDir = path.join(projectDir, relDir);
    if (!fs.existsSync(absDir)) continue;
    const scanned = walkFiles(absDir, { skipDirs: new Set() }).filter((file) => path.basename(file.rel) !== '.gitkeep');
    uploadFiles.push(...scanned);
  }

  let totalBytes = 0;
  const candidates = [];
  let skippedForCount = 0;
  let skippedForSize = 0;
  let skippedForFileSize = 0;

  uploadFiles.sort((a, b) => b.size - a.size);
  for (const file of uploadFiles) {
    if (candidates.length >= DUP_MAX_FILES) {
      skippedForCount += 1;
      continue;
    }
    if (file.size > DUP_MAX_FILE_BYTES) {
      skippedForFileSize += 1;
      continue;
    }
    if (totalBytes + file.size > DUP_MAX_TOTAL_BYTES) {
      skippedForSize += 1;
      continue;
    }
    totalBytes += file.size;
    candidates.push(file);
  }

  const bySize = new Map();
  for (const file of candidates) {
    const key = String(file.size);
    if (!bySize.has(key)) bySize.set(key, []);
    bySize.get(key).push(file);
  }

  const duplicateGroups = [];
  for (const group of bySize.values()) {
    if (group.length < 2) continue;
    const byHash = new Map();
    for (const file of group) {
      let hash = '';
      try {
        hash = await sha256File(file.path);
      } catch {
        continue;
      }
      if (!byHash.has(hash)) byHash.set(hash, []);
      byHash.get(hash).push(file);
    }
    for (const [hash, hashedGroup] of byHash.entries()) {
      if (hashedGroup.length < 2) continue;
      duplicateGroups.push({
        hash,
        size: hashedGroup[0].size,
        files: hashedGroup.map((entry) => entry.rel).sort()
      });
    }
  }

  duplicateGroups.sort((a, b) => b.files.length - a.files.length || b.size - a.size);
  return {
    scannedFiles: candidates.length,
    scannedBytes: totalBytes,
    skippedForCount,
    skippedForSize,
    skippedForFileSize,
    duplicateGroups
  };
}

function checkReviewSafetyAlignment(gitignoreText, zipScriptText) {
  const missingInGitignore = [];
  const missingInZipScript = [];
  const aligned = [];

  for (const rule of REVIEW_SAFETY_RULES) {
    const gitignoreOk = rule.gitignore.some((pattern) => pattern.test(gitignoreText));
    const zipOk = rule.zip.some((pattern) => pattern.test(zipScriptText));

    if (gitignoreOk && zipOk) {
      aligned.push(rule.name);
    } else {
      if (!gitignoreOk) missingInGitignore.push(rule.name);
      if (!zipOk) missingInZipScript.push(rule.name);
    }
  }

  return { aligned, missingInGitignore, missingInZipScript };
}

function printSection(title, lines, emptyMessage) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!lines.length) {
    console.log(emptyMessage);
    return;
  }
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

async function main() {
  const allFiles = walkFiles(projectDir, { skipDirs: WALK_SKIP_DIRS });
  const sourceFiles = walkFiles(projectDir, { skipDirs: SOURCE_SKIP_DIRS }).filter((file) => isSourceFile(file.rel));

  const largeFiles = allFiles
    .filter((file) => file.size >= LARGE_FILE_BYTES)
    .sort((a, b) => b.size - a.size)
    .slice(0, TOP_FILE_LIMIT)
    .map((file) => `${file.rel} (${formatBytes(file.size)})`);

  const largestSourceByLines = sourceFiles
    .map((file) => ({ ...file, lines: countLinesSafe(file.path) }))
    .filter((file) => typeof file.lines === 'number')
    .sort((a, b) => b.lines - a.lines)
    .slice(0, TOP_FILE_LIMIT)
    .map((file) => `${file.rel} (${file.lines} lines, ${formatBytes(file.size)})`);

  const suspiciousFilesAll = allFiles.filter((file) => isSuspiciousPath(file.rel)).sort((a, b) => a.rel.localeCompare(b.rel));
  const suspiciousMatches = suspiciousFilesAll
    .slice(0, SUSPICIOUS_LIST_LIMIT)
    .map((file) => `${file.rel} (${formatBytes(file.size)})`);

  const duplicateReport = await findDuplicateUploadArtifacts();

  const gitignorePath = path.join(projectDir, '.gitignore');
  const zipScriptPath = path.join(projectDir, 'scripts', 'create-review-zip.sh');
  const gitignoreText = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const zipScriptText = fs.existsSync(zipScriptPath) ? fs.readFileSync(zipScriptPath, 'utf8') : '';
  const alignment = checkReviewSafetyAlignment(gitignoreText, zipScriptText);

  console.log('Project cleanup check');
  console.log('Read-only report. No files were changed or deleted.');
  console.log(`Thresholds: large file >= ${formatBytes(LARGE_FILE_BYTES)}, top list limit = ${TOP_FILE_LIMIT}`);

  printSection('Largest files over threshold', largeFiles, `None found over ${formatBytes(LARGE_FILE_BYTES)}.`);
  printSection('Largest source files by line count', largestSourceByLines, 'No source files scanned.');
  printSection('Suspicious files (not for commit/share)', suspiciousMatches, 'None detected by current rules.');
  console.log(`Suspicious file matches: ${suspiciousFilesAll.length} (showing up to ${SUSPICIOUS_LIST_LIMIT})`);

  const duplicateLines = duplicateReport.duplicateGroups.slice(0, TOP_FILE_LIMIT).map((group) => {
    const sample = group.files.slice(0, 3).join(', ');
    const extra = group.files.length > 3 ? ` (+${group.files.length - 3} more)` : '';
    return `${group.files.length} duplicates, ${formatBytes(group.size)} each, sha256=${group.hash.slice(0, 12)}..., files: ${sample}${extra}`;
  });
  printSection('Duplicate upload artifacts by content hash', duplicateLines, 'No duplicate upload artifacts detected in scanned files.');
  console.log(`Scanned upload files for duplicates: ${duplicateReport.scannedFiles} (${formatBytes(duplicateReport.scannedBytes)})`);
  if (duplicateReport.skippedForCount || duplicateReport.skippedForSize || duplicateReport.skippedForFileSize) {
    console.log(
      `Skipped for safety limits: max-file-count=${duplicateReport.skippedForCount}, max-total-bytes=${duplicateReport.skippedForSize}, max-file-bytes=${duplicateReport.skippedForFileSize}`
    );
  }

  printSection('Review zip vs .gitignore alignment: covered in both', alignment.aligned, 'No shared safety rules matched.');
  printSection('Review safety rules missing in .gitignore', alignment.missingInGitignore, 'None.');
  printSection('Review safety rules missing in create-review-zip.sh', alignment.missingInZipScript, 'None.');

  const totalFindings =
    largeFiles.length +
    suspiciousFilesAll.length +
    duplicateReport.duplicateGroups.length +
    alignment.missingInGitignore.length +
    alignment.missingInZipScript.length;
  console.log(`\nTotal reported items: ${totalFindings}`);
}

main().catch((error) => {
  console.error('Cleanup check failed:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
