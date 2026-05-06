const fs = require('node:fs');
const path = require('node:path');

const projectRoot = process.cwd();
const bankPath = path.join(projectRoot, 'knowledge', 'standards', 'missouri_science_6_12_standards.json');
const overlayPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(projectRoot, 'standards_metadata_overlay.phase7a3.json');

if (!fs.existsSync(bankPath)) {
  throw new Error(`Missing standards bank: ${bankPath}`);
}
if (!fs.existsSync(overlayPath)) {
  throw new Error(`Missing overlay file: ${overlayPath}`);
}

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
const overlayById = new Map((overlay.standards || []).map((item) => [item.standardId, item]));

let updated = 0;
let missing = [];
for (const standard of bank.standards || []) {
  const enrichment = overlayById.get(standard.standardId);
  if (!enrichment) {
    missing.push(standard.standardId);
    continue;
  }
  for (const [key, value] of Object.entries(enrichment)) {
    if (key === 'standardId') continue;
    standard[key] = value;
  }
  updated += 1;
}

if (missing.length) {
  console.warn('Missing overlay rows for:', missing.join(', '));
}

bank.source = {
  ...(bank.source || {}),
  publisher: 'Missouri Department of Elementary and Secondary Education',
  document: '6-12 Science Grade-Level Expectations',
  documentYear: '2016',
  sourceType: 'official_state_standard',
  providedFile: 'curr-mls-standards-sci-6-12-sboe-2016_AOD.pdf',
  notes: 'Official standard text was enriched from the user-provided Missouri DESE 6-12 Science Grade-Level Expectations PDF. Student-friendly fields are teacher-reviewable paraphrases.'
};

fs.writeFileSync(bankPath, JSON.stringify(bank, null, 2) + '\n');
console.log(`Applied Phase 7A.3 standards enrichment to ${updated} standards.`);
