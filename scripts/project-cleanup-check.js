const fs = require('fs');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const skipDirs = new Set(['.git', 'node_modules', '.venv', 'vendor']);
const expectedFolders = ['audio', 'backups', 'knowledge', 'lib', 'logs', 'models', 'public', 'routes', 'scripts', 'voices'];
const mediaExtensions = new Set(['.mp3', '.mp4', '.wav', '.webm', '.ogg', '.m4a', '.mov', '.avi', '.mkv']);
const largeMediaBytes = Number(process.env.CLEANUP_LARGE_MEDIA_BYTES || 25 * 1024 * 1024);

const findings = {
  bakFiles: [],
  backupFilesOutsideBackups: [],
  largeMediaFiles: [],
  missingExpectedFolders: [],
  missingPackageDependencies: [],
  missingVoiceModelFiles: []
};

function relativePath(filePath) {
  return path.relative(projectDir, filePath) || '.';
}

function isInsideBackups(relativeFilePath) {
  return relativeFilePath === 'backups' || relativeFilePath.startsWith('backups' + path.sep);
}

function looksLikeBackupFile(fileName) {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName.endsWith('.bak') ||
    lowerName.includes('.bak-') ||
    lowerName.includes('.backup') ||
    lowerName.includes('backup-') ||
    lowerName.includes('.before-')
  );
}

function walk(dirPath, visitFile) {
  let entries = [];

  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) {
        walk(fullPath, visitFile);
      }
      return;
    }

    if (entry.isFile()) {
      visitFile(fullPath, entry.name);
    }
  });
}

function scanFiles() {
  walk(projectDir, (filePath, fileName) => {
    const rel = relativePath(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const stat = fs.statSync(filePath);

    if (
      !isInsideBackups(rel) &&
      (fileName.toLowerCase().endsWith('.bak') || fileName.toLowerCase().includes('.bak-'))
    ) {
      findings.bakFiles.push(rel);
    }

    if (!isInsideBackups(rel) && looksLikeBackupFile(fileName)) {
      findings.backupFilesOutsideBackups.push(rel);
    }

    if (mediaExtensions.has(ext) && stat.size >= largeMediaBytes) {
      findings.largeMediaFiles.push(formatFileSize(rel, stat.size));
    }
  });
}

function checkExpectedFolders() {
  expectedFolders.forEach((folder) => {
    if (!fs.existsSync(path.join(projectDir, folder))) {
      findings.missingExpectedFolders.push(folder + '/');
    }
  });
}

function checkPackageDependencies() {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  });

  dependencyNames.forEach((dependencyName) => {
    if (!fs.existsSync(path.join(projectDir, 'node_modules', dependencyName))) {
      findings.missingPackageDependencies.push(dependencyName);
    }
  });
}

function checkVoiceModelFiles() {
  const voicesDir = path.join(projectDir, 'voices');
  const modelsDir = path.join(projectDir, 'models');
  const voiceFiles = fs.existsSync(voicesDir)
    ? fs.readdirSync(voicesDir).filter((file) => file.toLowerCase().endsWith('.onnx'))
    : [];

  if (!voiceFiles.length) {
    findings.missingVoiceModelFiles.push('voices/*.onnx');
  }

  voiceFiles.forEach((file) => {
    if (!fs.existsSync(path.join(voicesDir, file + '.json'))) {
      findings.missingVoiceModelFiles.push('voices/' + file + '.json');
    }
  });

  if (!fs.existsSync(path.join(modelsDir, 'ggml-tiny.en.bin'))) {
    findings.missingVoiceModelFiles.push('models/ggml-tiny.en.bin');
  }
}

function formatFileSize(rel, bytes) {
  return rel + ' (' + (bytes / 1024 / 1024).toFixed(1) + ' MB)';
}

function printSection(title, items, emptyMessage) {
  console.log('\n' + title);
  console.log('-'.repeat(title.length));

  if (!items.length) {
    console.log(emptyMessage);
    return;
  }

  items.sort().forEach((item) => {
    console.log('- ' + item);
  });
}

scanFiles();
checkExpectedFolders();
checkPackageDependencies();
checkVoiceModelFiles();

console.log('Project cleanup check');
console.log('This report is read-only. No files were changed or deleted.');

printSection('Active-source backup/junk .bak files', findings.bakFiles, 'None found.');
printSection('Backup-looking files outside backups/', findings.backupFilesOutsideBackups, 'None found.');
printSection('Large media files', findings.largeMediaFiles, 'None found over ' + Math.round(largeMediaBytes / 1024 / 1024) + ' MB.');
printSection('Missing expected folders', findings.missingExpectedFolders, 'All expected folders are present.');
printSection('Missing package dependencies', findings.missingPackageDependencies, 'All package dependencies are installed.');
printSection('Missing voice/model files', findings.missingVoiceModelFiles, 'Voice and Whisper model files look present.');

const totalFindings = Object.values(findings).reduce((total, items) => total + items.length, 0);
console.log('\nTotal reported items: ' + totalFindings);
