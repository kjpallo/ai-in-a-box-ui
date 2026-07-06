const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const extractScript = path.join(projectRoot, 'scripts', 'extract-unit7-atomic-structure-source.js');
const extractJson = path.join(projectRoot, 'tmp', 'unit7-atomic-structure-source-extract.json');
const extractMd = path.join(projectRoot, 'tmp', 'unit7-atomic-structure-source-audit.md');
const sourceDir = path.join(projectRoot, 'docs', 'source', 'unit7-atomic-structure');

execFileSync('node', [extractScript], {
  cwd: projectRoot,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024
});

assert.ok(fs.existsSync(extractJson), 'source extractor should write JSON audit output');
assert.ok(fs.existsSync(extractMd), 'source extractor should write markdown audit output');

const audit = JSON.parse(fs.readFileSync(extractJson, 'utf8'));
assert.equal(audit.sourceDir, sourceDir);
assert.ok(Array.isArray(audit.requiredSources));
assert.ok(audit.requiredSources.includes('Concept 1 Notes - Structure of the Atom.pptx'));
assert.ok(audit.requiredSources.includes('Test Key Honors (2).pdf'));
assert.ok(audit.tools && typeof audit.tools === 'object');
assert.equal(typeof audit.tools.pdftotext, 'boolean');
assert.equal(typeof audit.tools.pdftoppm, 'boolean');
assert.equal(typeof audit.tools.tesseract, 'boolean');

if (fs.existsSync(sourceDir)) {
  assert.ok(Array.isArray(audit.sources), 'audit should include processed source files');
  assert.ok(audit.sources.length > 0, 'source directory should produce at least one source audit entry');
  const processedNames = audit.sources.map((source) => source.filename).join(' ');
  assert.match(processedNames, /\.(pdf|pptx)/i);
} else {
  assert.ok(audit.warnings.some((warning) => /Source directory not found/i.test(warning)));
  assert.equal(audit.missingRequiredSources.length, audit.requiredSources.length);
}

const markdown = fs.readFileSync(extractMd, 'utf8');
assert.match(markdown, /Unit 7 Atomic Structure Source Audit/i);
assert.match(markdown, /Tool Availability/i);

console.log('PASS Unit 7 source extraction audit script: source discovery, OCR tool audit, and generated tmp reports');
