const { loadDraftKnowledgePacks } = require('../lib/knowledge/loadDraftKnowledgePacks');

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
const COUNTED_SECTIONS = [
  'vocabulary',
  'concepts',
  'referenceFormulas',
  'problemBank',
  'standardsMap',
  'smokeTests'
];

const loadResult = loadDraftKnowledgePacks();

console.log('Draft Knowledge Packs Inspection');
console.log('================================');
console.log(`Draft packs directory: ${loadResult.draftPacksDir}`);
console.log(`Draft packs loaded: ${loadResult.packs.length}`);
console.log(`Invalid draft packs/errors: ${loadResult.errors.length}`);
console.log('');

if (loadResult.packs.length === 0) {
  console.log('No draft knowledge packs found.');
} else {
  console.log('Draft Packs');
  console.log('-----------');
  loadResult.packs.forEach((record) => {
    const pack = record.pack;

    console.log(`- ${record.packId}`);
    console.log(`  Title: ${record.title}`);
    console.log(`  Subject: ${record.subject}`);
    console.log(`  Grade level: ${record.gradeLevel}`);
    console.log(`  Version: ${record.version}`);
    console.log(`  Vocabulary terms: ${countItems(pack.vocabulary)}`);
    console.log(`  Concepts: ${countItems(pack.concepts)}`);
    console.log(`  Reference formulas: ${countItems(pack.referenceFormulas)}`);
    console.log(`  ProblemBank items: ${countItems(pack.problemBank)}`);
    console.log(`  StandardsMap entries: ${countItems(pack.standardsMap)}`);
    console.log(`  Smoke tests: ${countItems(pack.smokeTests)}`);
    console.log('  Review status counts by section:');
    COUNTED_SECTIONS.forEach((sectionName) => {
      const counts = countReviewStatuses(pack[sectionName]);
      console.log(`    ${sectionName}: pending=${counts.pending}, approved=${counts.approved}, rejected=${counts.rejected}`);
    });
  });
}

if (loadResult.errors.length > 0) {
  console.log('');
  console.log('Validation Errors');
  console.log('-----------------');
  loadResult.errors.forEach((errorRecord) => {
    console.log(`- ${errorRecord.sourcePath}`);
    (errorRecord.errors || []).forEach((message) => {
      console.log(`  - ${message}`);
    });
  });
}

function countItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.length;
}

function countReviewStatuses(items) {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0
  };

  if (!Array.isArray(items)) return counts;

  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (REVIEW_STATUSES.includes(item.reviewStatus)) {
      counts[item.reviewStatus] += 1;
    }
  });

  return counts;
}
