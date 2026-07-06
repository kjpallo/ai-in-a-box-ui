#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_DIR = path.join(PROJECT_ROOT, 'docs', 'source', 'unit7-atomic-structure');
const OUT_JSON = path.join(PROJECT_ROOT, 'tmp', 'unit7-atomic-structure-source-extract.json');
const OUT_MD = path.join(PROJECT_ROOT, 'tmp', 'unit7-atomic-structure-source-audit.md');

const REQUIRED_SOURCES = [
  '8th Science TEST atoms, PT history, PT info .pdf',
  'HW 1.5 Atomic Structure .pdf',
  'Atomic Structure _ .pdf',
  'Packet KEY - Atomic Structure Honors.pdf',
  'Test Key Honors (2).pdf',
  'Review Game Atomic Structure.pptx',
  'Concept 1 Notes - Structure of the Atom.pptx',
  'Concept 2 Notes - Isotopes.pptx',
  'Concept 3 Notes -Periodic Table.pptx'
];

function main() {
  const sourceDir = path.resolve(process.argv[2] || DEFAULT_SOURCE_DIR);
  const audit = {
    sourceDir,
    generatedAt: new Date().toISOString(),
    requiredSources: REQUIRED_SOURCES,
    tools: toolAvailability(),
    sources: [],
    warnings: [],
    missingRequiredSources: []
  };

  if (!fs.existsSync(sourceDir)) {
    audit.warnings.push(`Source directory not found: ${sourceDir}`);
    audit.missingRequiredSources = [...REQUIRED_SOURCES];
    writeAudit(audit);
    console.log(`Unit 7 source directory not found. Wrote audit to ${relative(OUT_MD)}.`);
    return;
  }

  const files = fs.readdirSync(sourceDir)
    .filter((file) => /\.(pdf|pptx)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));
  const lowerFiles = new Set(files.map((file) => file.toLowerCase()));
  audit.missingRequiredSources = REQUIRED_SOURCES.filter((file) => !lowerFiles.has(file.toLowerCase()));

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const ext = path.extname(file).toLowerCase();
    try {
      const result = ext === '.pdf'
        ? extractPdf(filePath)
        : extractPptx(filePath);
      audit.sources.push(result);
    } catch (error) {
      audit.sources.push({
        filename: file,
        error: error.message,
        pagesOrSlidesProcessed: 0,
        directTextCharCount: 0,
        ocrTextCharCount: 0,
        highValueContent: []
      });
      audit.warnings.push(`${file}: ${error.message}`);
    }
  }

  writeAudit(audit);
  console.log(`Wrote ${relative(OUT_JSON)} and ${relative(OUT_MD)}.`);
}

function extractPdf(filePath) {
  const filename = path.basename(filePath);
  const directText = commandExists('pdftotext')
    ? runTextCommand('pdftotext', ['-layout', filePath, '-'])
    : '';
  const pageCount = getPdfPageCount(filePath);
  const pageOcr = commandExists('pdftoppm') && commandExists('tesseract')
    ? ocrPdfPages(filePath)
    : [];

  return summarizeSource({
    filename,
    kind: 'pdf',
    pageCount,
    directText,
    pageOcr
  });
}

function extractPptx(filePath) {
  const filename = path.basename(filePath);
  const slideXml = extractPptxSlideXmlText(filePath);
  const mediaOcr = commandExists('unzip') && commandExists('tesseract')
    ? ocrPptxMedia(filePath)
    : [];
  const slideRenderOcr = commandExists('soffice') && commandExists('pdftoppm') && commandExists('tesseract')
    ? ocrPptxRenderedSlides(filePath)
    : [];
  const pageOcr = [...mediaOcr, ...slideRenderOcr];

  return summarizeSource({
    filename,
    kind: 'pptx',
    pageCount: slideXml.length,
    directText: slideXml.map((slide) => slide.text).join('\n\n'),
    pageOcr
  });
}

function summarizeSource({ filename, kind, pageCount, directText, pageOcr }) {
  const ocrText = pageOcr.map((item) => item.text).join('\n\n');
  const directByPage = splitDirectTextByPage(directText, pageCount);
  const ocrOnlyLocations = pageOcr
    .filter((item) => String(item.text || '').trim().length > 30)
    .filter((item) => String(directByPage[item.index - 1] || '').trim().length < 30)
    .map((item) => item.location);
  const mergedText = dedupeLines([directText, ocrText].join('\n'));

  return {
    filename,
    kind,
    pagesOrSlidesProcessed: pageCount || pageOcr.length || 0,
    directTextCharCount: directText.length,
    ocrTextCharCount: ocrText.length,
    ocrOnlyLocations,
    highValueContent: detectHighValueContent(mergedText),
    sample: mergedText.slice(0, 1200),
    entries: pageOcr.map((item) => ({
      location: item.location,
      ocrTextCharCount: item.text.length
    }))
  };
}

function ocrPdfPages(filePath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unit7-pdf-ocr-'));
  try {
    const prefix = path.join(tmp, 'page');
    spawnSync('pdftoppm', ['-png', '-r', '220', filePath, prefix], { stdio: 'ignore' });
    return fs.readdirSync(tmp)
      .filter((file) => file.endsWith('.png'))
      .sort()
      .map((file, index) => ({
        index: index + 1,
        location: `Page ${index + 1}`,
        text: ocrImage(path.join(tmp, file))
      }));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function extractPptxSlideXmlText(filePath) {
  if (!commandExists('unzip')) return [];
  const listing = runTextCommand('unzip', ['-Z1', filePath]);
  const slideFiles = listing.split(/\r?\n/)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file))
    .sort((a, b) => Number(a.match(/slide(\d+)/)[1]) - Number(b.match(/slide(\d+)/)[1]));

  return slideFiles.map((slideFile, index) => {
    const xml = runTextCommand('unzip', ['-p', filePath, slideFile]);
    return {
      index: index + 1,
      location: `Slide ${index + 1}`,
      text: xml
        .replace(/<a:t>/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
    };
  });
}

function ocrPptxMedia(filePath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unit7-pptx-media-'));
  try {
    spawnSync('unzip', ['-q', filePath, 'ppt/media/*', '-d', tmp], { stdio: 'ignore' });
    const mediaDir = path.join(tmp, 'ppt', 'media');
    if (!fs.existsSync(mediaDir)) return [];
    return fs.readdirSync(mediaDir)
      .filter((file) => /\.(png|jpe?g|tiff?)$/i.test(file))
      .sort()
      .map((file, index) => ({
        index: index + 1,
        location: `Embedded image ${index + 1}`,
        text: ocrImage(path.join(mediaDir, file))
      }));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function ocrPptxRenderedSlides(filePath) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unit7-pptx-render-'));
  try {
    spawnSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tmp, filePath], { stdio: 'ignore' });
    const pdf = fs.readdirSync(tmp).find((file) => file.endsWith('.pdf'));
    if (!pdf) return [];
    return ocrPdfPages(path.join(tmp, pdf)).map((item) => ({
      ...item,
      location: item.location.replace('Page', 'Rendered slide')
    }));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function ocrImage(filePath) {
  try {
    return runTextCommand('tesseract', [filePath, 'stdout', '--psm', '6']).trim();
  } catch {
    return '';
  }
}

function getPdfPageCount(filePath) {
  if (!commandExists('pdfinfo')) return 0;
  const output = runTextCommand('pdfinfo', [filePath]);
  const match = /^Pages:\s+(\d+)/m.exec(output);
  return match ? Number(match[1]) : 0;
}

function splitDirectTextByPage(text, pageCount) {
  if (!text) return [];
  const formFeedPages = text.split('\f');
  if (formFeedPages.length > 1) return formFeedPages;
  if (!pageCount) return [text];
  return Array.from({ length: pageCount }, (_, index) => (index === 0 ? text : ''));
}

function detectHighValueContent(text) {
  const checks = [
    ['vocabulary', /\b(?:vocabulary|atom|proton|neutron|electron|isotope|valence|nucleus)\b/i],
    ['formulas/rules', /\b(?:mass number|atomic number|neutrons?\s*=|protons?\s*\+|energy levels?|shells?)\b/i],
    ['question-answer pairs', /\b(?:answer key|test key|review|what is|which|how many)\b/i],
    ['diagrams/tables', /\b(?:diagram|model|bohr|periodic table|group|period|nucleus|electron cloud)\b/i],
    ['answer keys', /\b(?:key|answers?|correct)\b/i]
  ];
  return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

function dedupeLines(text) {
  const seen = new Set();
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join('\n');
}

function writeAudit(audit) {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(OUT_MD, renderMarkdownAudit(audit));
}

function renderMarkdownAudit(audit) {
  const lines = [
    '# Unit 7 Atomic Structure Source Audit',
    '',
    `Source directory: ${audit.sourceDir}`,
    `Generated: ${audit.generatedAt}`,
    '',
    '## Tool Availability',
    ''
  ];
  for (const [tool, available] of Object.entries(audit.tools)) {
    lines.push(`- ${tool}: ${available ? 'available' : 'missing'}`);
  }
  lines.push('', '## Missing Required Sources', '');
  if (audit.missingRequiredSources.length === 0) lines.push('- None');
  else audit.missingRequiredSources.forEach((file) => lines.push(`- ${file}`));
  lines.push('', '## Sources', '');
  if (audit.sources.length === 0) lines.push('- No source files processed.');
  for (const source of audit.sources) {
    lines.push(`### ${source.filename}`);
    if (source.error) lines.push(`- Error: ${source.error}`);
    lines.push(`- Pages/slides processed: ${source.pagesOrSlidesProcessed}`);
    lines.push(`- Direct text characters: ${source.directTextCharCount}`);
    lines.push(`- OCR text characters: ${source.ocrTextCharCount}`);
    lines.push(`- OCR-only locations: ${source.ocrOnlyLocations?.length ? source.ocrOnlyLocations.join(', ') : 'none'}`);
    lines.push(`- High-value content: ${source.highValueContent?.length ? source.highValueContent.join(', ') : 'none detected'}`);
    lines.push('');
  }
  if (audit.warnings.length) {
    lines.push('## Warnings', '');
    audit.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }
  return `${lines.join('\n')}\n`;
}

function toolAvailability() {
  return {
    pdftotext: commandExists('pdftotext'),
    pdfinfo: commandExists('pdfinfo'),
    pdftoppm: commandExists('pdftoppm'),
    tesseract: commandExists('tesseract'),
    soffice: commandExists('soffice'),
    unzip: commandExists('unzip')
  };
}

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${shellEscape(command)}`], { stdio: 'ignore' });
  return result.status === 0;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function runTextCommand(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
}

function relative(filePath) {
  return path.relative(PROJECT_ROOT, filePath);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_SOURCE_DIR,
  REQUIRED_SOURCES,
  detectHighValueContent,
  main
};
