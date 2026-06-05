#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const LARGE_FILE_BYTES = Number(process.env.CLEANUP_LARGE_FILE_BYTES || 5 * 1024 * 1024);
const LARGE_SOURCE_LINES = Number(process.env.CLEANUP_LARGE_SOURCE_LINES || 1000);
const TOP_FILE_LIMIT = Number(process.env.CLEANUP_TOP_FILE_LIMIT || 20);
const SUSPICIOUS_LIST_LIMIT = Number(process.env.CLEANUP_SUSPICIOUS_LIST_LIMIT || 50);
const DUP_MAX_FILES = Number(process.env.CLEANUP_DUP_MAX_FILES || 2000);
const DUP_MAX_TOTAL_BYTES = Number(process.env.CLEANUP_DUP_MAX_TOTAL_BYTES || 1 * 1024 * 1024 * 1024);
const DUP_MAX_FILE_BYTES = Number(process.env.CLEANUP_DUP_MAX_FILE_BYTES || 200 * 1024 * 1024);

const WALK_SKIP_DIRS = new Set(['.git', 'node_modules']);
const SOURCE_SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  '.cache',
  '.pytest_cache',
  'vendor',
  'backups',
  'tmp',
  'logs',
  'audio',
  'coverage',
  'deleted-approved-packs',
  'dist',
  'build',
  'models',
  'voices',
  '_accepted',
  '_removed',
  'review-handoff'
]);
const SOURCE_SKIP_REL_PREFIXES = [
  'knowledge/uploads'
];
const SOURCE_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
  '.css', '.scss', '.html', '.md',
  '.json', '.yaml', '.yml', '.sh', '.py'
]);

const REVIEW_SAFETY_RULES = [
  { name: '.git', gitignore: [/^\.git\/?$/m], zip: [/\.git\/\*/] },
  { name: 'node_modules', gitignore: [/^node_modules\/?$/m], zip: [/node_modules\/\*/] },
  { name: '.DS_Store', gitignore: [/^\.DS_Store$/m], zip: [/\.DS_Store/] },
  { name: '.env and .env.*', gitignore: [/^\.env$/m, /^\.env\.\*$/m], zip: [/\.env/, /\.env\.\*/] },
  { name: 'logs', gitignore: [/^logs\/?$/m], zip: [/logs\/\*/] },
  { name: 'audio', gitignore: [/^audio\/\*$/m], zip: [/audio\/\*/] },
  { name: 'coverage', gitignore: [/^coverage\/?$/m], zip: [/coverage\/\*/] },
  { name: 'dist', gitignore: [/^dist\/?$/m], zip: [/dist\/\*/] },
  { name: 'build', gitignore: [/^build\/?$/m], zip: [/build\/\*/] },
  { name: 'voices/*.onnx', gitignore: [/^voices\/\*\.onnx$/m], zip: [/voices\/\*\.onnx/] },
  { name: 'voices/*.json', gitignore: [/^voices\/\*\.json$/m], zip: [/voices\/\*\.json/] },
  { name: 'models', gitignore: [/^models\/?$/m], zip: [/models\/\*/] },
  { name: 'vendor', gitignore: [/^vendor\/?$/m], zip: [/vendor\/\*/] },
  { name: 'backups', gitignore: [/^backups\/?$/m], zip: [/backups\/\*/] },
  { name: 'tmp', gitignore: [/^tmp\/?$/m], zip: [/tmp\/\*/] },
  { name: 'review-handoff', gitignore: [/^review-handoff\/?$/m], zip: [/review-handoff\/\*/] },
  { name: 'knowledge/deleted-approved-packs', gitignore: [/^knowledge\/deleted-approved-packs\/?$/m], zip: [/knowledge\/deleted-approved-packs\/\*/] },
  { name: 'knowledge/draft-packs/_accepted', gitignore: [/^knowledge\/draft-packs\/_accepted\/?$/m], zip: [/knowledge\/draft-packs\/_accepted\/\*/] },
  { name: 'knowledge/draft-packs/_removed', gitignore: [/^knowledge\/draft-packs\/_removed\/?$/m], zip: [/knowledge\/draft-packs\/_removed\/\*/] },
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
  /(^|\/)coverage\//i,
  /(^|\/)dist\//i,
  /(^|\/)build\//i,
  /(^|\/)models\//i,
  /(^|\/)vendor\//i,
  /(^|\/)backups\//i,
  /(^|\/)review-handoff\//i,
  /(^|\/)tmp\//i,
  /(^|\/)knowledge\/deleted-approved-packs\//i,
  /(^|\/)knowledge\/draft-packs\/_(accepted|removed)\//i,
  /(^|\/)knowledge\/uploads\/(incoming|extracted|page-images|ocr)\//i,
  /(^|\/)voices\/[^/]*\.(onnx|json)$/i,
  /(^|\/)[^/]*(token|secret|oauth|gmail[_-]?auth|teacher[_-]?auth)[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$/i,
  /(^|\/)[^/]*auth[^/]*\.(json|txt|key|pem|env|ini|yaml|yml)$/i,
  /(^|\/)[^/]*\.(pem|key|p12|pfx|zip|log|bak|tmp|temp)$/i
];

const UPLOAD_DIRS = [
  'knowledge/uploads/incoming',
  'knowledge/uploads/extracted',
  'knowledge/uploads/page-images',
  'knowledge/uploads/ocr'
];

const LOCAL_ARTIFACT_DIRS = [
  { path: 'backups', reason: 'backup snapshots' },
  { path: 'tmp', reason: 'scratch/debug output' },
  { path: 'review-handoff', reason: 'review/export handoff output' },
  { path: 'logs', reason: 'local logs and auth state' },
  { path: 'audio', reason: 'generated TTS audio' },
  { path: 'knowledge/uploads/incoming', reason: 'original uploaded teacher files' },
  { path: 'knowledge/uploads/extracted', reason: 'extracted upload text/cache' },
  { path: 'knowledge/uploads/page-images', reason: 'upload page images' },
  { path: 'knowledge/uploads/ocr', reason: 'upload OCR cache' },
  { path: 'knowledge/deleted-approved-packs', reason: 'deleted approved-pack archive' },
  { path: 'knowledge/draft-packs/_accepted', reason: 'accepted draft-pack archive' },
  { path: 'knowledge/draft-packs/_removed', reason: 'removed draft-pack archive' },
  { path: 'voices', reason: 'local Piper voice models/metadata' },
  { path: 'models', reason: 'local model files' },
  { path: 'vendor', reason: 'local third-party tool checkouts' }
];

const DUPLICATE_BASENAME_IGNORE = new Set([
  'index.js',
  'README.md',
  'package.json',
  'package-lock.json'
]);

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
  const skipRelPrefixes = options.skipRelPrefixes || [];
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
        const relPath = toRelative(fullPath);
        const skipRelPath = skipRelPrefixes.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`));
        if (!skipDirs.has(entry.name) && !skipRelPath) {
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

function resolveRequireTarget(fromFile, request) {
  if (!request.startsWith('.')) return '';
  let targetPath = path.resolve(path.dirname(fromFile), request);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) return targetPath;

  const extensions = ['.js', '.cjs', '.mjs', '.json'];
  for (const ext of extensions) {
    if (fs.existsSync(`${targetPath}${ext}`)) return `${targetPath}${ext}`;
  }

  const indexPath = path.join(targetPath, 'index.js');
  if (fs.existsSync(indexPath)) return indexPath;
  return '';
}

function findCompatibilityWrappers(sourceFiles) {
  return sourceFiles
    .filter((file) => {
      const parts = file.rel.split('/');
      return parts.length === 2 && parts[0] === 'lib' && path.extname(file.rel) === '.js';
    })
    .map((file) => {
      let text = '';
      try {
        text = fs.readFileSync(file.path, 'utf8').trim();
      } catch {
        return null;
      }

      const match = text.match(/^module\.exports\s*=\s*require\(['"](.+)['"]\);?$/);
      if (!match) return null;

      const targetPath = resolveRequireTarget(file.path, match[1]);
      if (!targetPath) return null;
      const targetRel = toRelative(targetPath);
      if (targetRel === file.rel) return null;

      return `${file.rel} -> ${targetRel}`;
    })
    .filter(Boolean)
    .sort();
}

function summarizeLocalArtifactDirs(allFiles) {
  return LOCAL_ARTIFACT_DIRS
    .map((entry) => {
      const absDir = path.join(projectDir, entry.path);
      if (!fs.existsSync(absDir)) return null;

      const files = allFiles.filter((file) => file.rel === entry.path || file.rel.startsWith(`${entry.path}/`));
      const nonKeepFiles = files.filter((file) => path.basename(file.rel) !== '.gitkeep');
      const totalBytes = nonKeepFiles.reduce((sum, file) => sum + file.size, 0);
      const countLabel = nonKeepFiles.length === 1 ? '1 file' : `${nonKeepFiles.length} files`;
      const sizeLabel = nonKeepFiles.length ? `, ${formatBytes(totalBytes)}` : '';
      const sample = nonKeepFiles
        .slice()
        .sort((a, b) => b.size - a.size)
        .slice(0, 2)
        .map((file) => file.rel)
        .join(', ');
      const sampleLabel = sample ? `; sample: ${sample}` : '';
      return `${entry.path} (${entry.reason}): ${countLabel}${sizeLabel}${sampleLabel}`;
    })
    .filter(Boolean);
}

function findDuplicateLookingSourceFiles(sourceFiles) {
  const byName = new Map();
  for (const file of sourceFiles) {
    const name = path.basename(file.rel);
    if (DUPLICATE_BASENAME_IGNORE.has(name)) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(file);
  }

  const duplicateGroups = [];
  for (const [name, files] of byName.entries()) {
    if (files.length < 2) continue;

    const enriched = files
      .map((file) => ({ ...file, lines: countLinesSafe(file.path) }))
      .sort((a, b) => a.rel.localeCompare(b.rel));
    const lineCounts = enriched.map((file) => file.lines).filter((lines) => typeof lines === 'number' && lines > 0);
    const minLines = lineCounts.length ? Math.min(...lineCounts) : 0;
    const maxLines = lineCounts.length ? Math.max(...lineCounts) : 0;
    const similarSize = minLines > 0 && maxLines > 0 && minLines / maxLines >= 0.8;
    const rootWrapper = enriched.some((file) => file.rel.split('/').length === 2 && file.lines <= 3);
    const reason = similarSize ? 'same basename, similar size' : rootWrapper ? 'same basename, includes root wrapper' : 'same basename';
    const entries = enriched
      .slice(0, 5)
      .map((file) => `${file.rel} (${typeof file.lines === 'number' ? `${file.lines} lines` : formatBytes(file.size)})`)
      .join(' | ');
    const extra = enriched.length > 5 ? ` | +${enriched.length - 5} more` : '';
    duplicateGroups.push(`${name}: ${reason}; ${entries}${extra}`);
  }

  return duplicateGroups.sort();
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

function checkReviewZipShape(zipScriptText) {
  const findings = [];
  if (!/ai-in-a-box-ui-review-\$\{TIMESTAMP\}\.zip/.test(zipScriptText)) {
    findings.push('review zip name should use ai-in-a-box-ui-review-${TIMESTAMP}.zip');
  }
  if (!/date\s+\+"\%Y-\%m-\%d-\%H\%M"/.test(zipScriptText)) {
    findings.push('review zip timestamp should use YYYY-MM-DD-HHMM');
  }
  if (!/DOWNLOADS_DIR="\$\{HOME\}\/Downloads"/.test(zipScriptText)) {
    findings.push('review zip should write to ~/Downloads');
  }
  if (/"knowledge"\s*(\n|\))/.test(zipScriptText)) {
    findings.push('review zip should include explicit knowledge subpaths instead of all of knowledge/');
  }
  for (const requiredPath of [
    'knowledge/approved-packs',
    'knowledge/draft-packs',
    'knowledge/packs',
    'knowledge/schema',
    'knowledge/standards',
    'knowledge/standards-banks'
  ]) {
    if (!zipScriptText.includes(`"${requiredPath}"`)) {
      findings.push(`review zip include set is missing ${requiredPath}`);
    }
  }
  return findings;
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
  const sourceFiles = walkFiles(projectDir, {
    skipDirs: SOURCE_SKIP_DIRS,
    skipRelPrefixes: SOURCE_SKIP_REL_PREFIXES
  }).filter((file) => isSourceFile(file.rel));

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
  const zipShapeFindings = checkReviewZipShape(zipScriptText);

  console.log('Project cleanup check');
  console.log('Read-only report. No files were changed or deleted.');
  console.log(
    `Thresholds: large file >= ${formatBytes(LARGE_FILE_BYTES)}, oversized source >= ${LARGE_SOURCE_LINES} lines, top list limit = ${TOP_FILE_LIMIT}`
  );

  printSection('Largest files over threshold', largeFiles, `None found over ${formatBytes(LARGE_FILE_BYTES)}.`);

  const oversizedSourceFiles = largestSourceByLines.filter((line) => {
    const match = line.match(/\((\d+) lines,/);
    return match && Number(match[1]) >= LARGE_SOURCE_LINES;
  });
  printSection('Oversized source files', oversizedSourceFiles, `None found over ${LARGE_SOURCE_LINES} lines.`);
  printSection('Largest source files by line count', largestSourceByLines, 'No source files scanned.');

  const duplicateLookingSourceFiles = findDuplicateLookingSourceFiles(sourceFiles).slice(0, TOP_FILE_LIMIT);
  printSection('Duplicate-looking source files', duplicateLookingSourceFiles, 'No duplicate-looking source names detected.');

  const compatibilityWrappers = findCompatibilityWrappers(sourceFiles);
  printSection('Stale root compatibility wrappers', compatibilityWrappers, 'No root compatibility wrappers detected.');

  const localArtifactDirs = summarizeLocalArtifactDirs(allFiles);
  printSection('Backup/local artifact folders', localArtifactDirs, 'No configured local artifact folders found.');

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
  printSection('Review zip shape warnings', zipShapeFindings, 'None.');

  const totalFindings =
    largeFiles.length +
    oversizedSourceFiles.length +
    duplicateLookingSourceFiles.length +
    compatibilityWrappers.length +
    localArtifactDirs.length +
    suspiciousFilesAll.length +
    duplicateReport.duplicateGroups.length +
    alignment.missingInGitignore.length +
    alignment.missingInZipScript.length +
    zipShapeFindings.length;
  console.log(`\nTotal reported items: ${totalFindings}`);
}

main().catch((error) => {
  console.error('Cleanup check failed:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
