const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const JSZip = require('jszip');
const xlsx = require('xlsx');

const { detectUploadFileType } = require('../lib/uploads/detectUploadFileType');
const { extractTextFromFile } = require('../lib/uploads/extractTextFromFile');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-upload-extraction');

main().catch((error) => {
  cleanupTempRoot();
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  cleanupTempRoot();
  fs.mkdirSync(tempRoot, { recursive: true });

  try {
    await assertTxtExtraction();
    await assertCsvExtraction();
    await assertJsonExtraction();
    await assertXlsxExtraction();
    await assertDocxExtraction();
    await assertPdfExtraction();
    await assertBlankPdfWarning();
    await assertUnsupportedExtension();
    await assertShortExtractionWarning();
  } finally {
    cleanupTempRoot();
  }

  console.log('Upload text extraction tests passed.');
}

async function assertTxtExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.txt');
  fs.writeFileSync(sourcePath, 'Balanced forces have a net force of zero.\nMotion changes when forces are unbalanced.\n');

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.txt');
  assert.equal(result.mimeGuess, 'text/plain');
  assert.ok(result.text.includes('Balanced forces'));
  assert.deepEqual(result.sections[0], {
    label: 'Full Text',
    text: result.text
  });
}

async function assertCsvExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.csv');
  fs.writeFileSync(sourcePath, 'term,definition\nforce,a push or pull\ninertia,resistance to motion change\n');

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.csv');
  assert.ok(result.text.includes('term | definition'));
  assert.equal(result.tables.length, 1);
  assert.equal(result.tables[0].label, 'CSV');
  assert.deepEqual(result.tables[0].rows[1], ['force', 'a push or pull']);
  assert.equal(result.metadata.rowCount, 3);
}

async function assertJsonExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.json');
  fs.writeFileSync(sourcePath, JSON.stringify({
    topic: 'Forces',
    facts: ['Net force changes motion', 'Balanced forces do not accelerate an object']
  }));

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.json');
  assert.ok(result.text.includes('"topic": "Forces"'));
  assert.equal(result.metadata.topLevelType, 'object');
}

async function assertXlsxExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.xlsx');
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet([
    ['Quantity', 'Unit'],
    ['Force', 'newton'],
    ['Mass', 'kilogram']
  ]);
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Physics');
  xlsx.writeFile(workbook, sourcePath);

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.xlsx');
  assert.ok(result.text.includes('Sheet: Physics'));
  assert.equal(result.tables.length, 1);
  assert.equal(result.tables[0].label, 'Physics');
  assert.deepEqual(result.tables[0].rows[2], ['Mass', 'kilogram']);
  assert.deepEqual(result.metadata.sheetNames, ['Physics']);
}

async function assertDocxExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.docx');
  await writeMinimalDocx(sourcePath, [
    'Teacher source document',
    'Potential energy depends on height and mass.'
  ]);

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.docx');
  assert.ok(result.text.includes('Teacher source document'));
  assert.ok(result.text.includes('Potential energy'));
  assert.equal(result.metadata.parser, 'mammoth');
}

async function assertPdfExtraction() {
  const sourcePath = path.join(tempRoot, 'sample.pdf');
  fs.writeFileSync(sourcePath, makeMinimalPdf('Embedded text from a teacher PDF.'));

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.extension, '.pdf');
  assert.ok(result.text.includes('Embedded text'));
  assert.equal(result.metadata.parser, 'pdf-parse');
  assert.equal(result.metadata.pageCount, 1);
  assert.equal(result.metadata.firstTextPage, 1);
  assert.deepEqual(result.metadata.textBearingPages, [1]);
  assert.deepEqual(result.metadata.pagesWithText, [1]);
}

async function assertBlankPdfWarning() {
  const sourcePath = path.join(tempRoot, 'blank.pdf');
  fs.writeFileSync(sourcePath, makeMinimalPdf(''));

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(result.warnings.some((warning) => warning.includes('may need OCR')));
}

async function assertUnsupportedExtension() {
  const sourcePath = path.join(tempRoot, 'sample.pptx');
  fs.writeFileSync(sourcePath, 'not supported in Phase 5A');

  const detected = detectUploadFileType(sourcePath);
  assert.equal(detected.supported, false);
  assert.ok(detected.errors[0].includes('Unsupported upload file type'));

  const result = await extractTextFromFile(sourcePath);
  assert.equal(result.success, false);
  assert.ok(result.errors.some((error) => error.includes('Unsupported upload file type')));
}

async function assertShortExtractionWarning() {
  const sourcePath = path.join(tempRoot, 'short.txt');
  fs.writeFileSync(sourcePath, 'short');

  const result = await extractTextFromFile(sourcePath);

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.ok(result.warnings.some((warning) => warning.includes('very short')));
}

async function writeMinimalDocx(filePath, paragraphs) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', xmlDeclaration(`\
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`));
  zip.folder('_rels').file('.rels', xmlDeclaration(`\
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`));
  zip.folder('word').file('document.xml', xmlDeclaration(`\
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map((paragraph) => `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`).join('\n    ')}
  </w:body>
</w:document>`));

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  fs.writeFileSync(filePath, content);
}

function xmlDeclaration(xml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}\n`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function makeMinimalPdf(text) {
  const escapedText = String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = escapedText
    ? `BT\n/F1 12 Tf\n72 720 Td\n(${escapedText}) Tj\nET\n`
    : '';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream\nendobj\n`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, {
    recursive: true,
    force: true
  });
}
