const { buildKnowledgePackIndex } = require('../lib/knowledge/buildKnowledgePackIndex');
const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');

const APPROVED_STATUS = 'approved';

const loadResult = loadApprovedKnowledgePacks();
const index = buildKnowledgePackIndex(loadResult.packs);

console.log('Approved Knowledge Packs Inspection');
console.log('===================================');
console.log(`Approved packs directory: ${loadResult.approvedPacksDir}`);
console.log(`Packs loaded: ${loadResult.packs.length}`);
console.log(`Invalid packs/errors: ${loadResult.errors.length}`);
console.log('');

if (loadResult.packs.length === 0) {
  console.log('No approved knowledge packs found.');
} else {
  console.log('Packs');
  console.log('-----');
  loadResult.packs.forEach((record) => {
    const pack = record.pack;

    console.log(`- ${record.packId}`);
    console.log(`  Title: ${record.title}`);
    console.log(`  Subject: ${record.subject}`);
    console.log(`  Grade level: ${record.gradeLevel}`);
    console.log(`  Version: ${record.version}`);
    console.log(`  Approved vocabulary terms: ${countApproved(pack.vocabulary)}`);
    console.log(`  Approved concepts: ${countApproved(pack.concepts)}`);
    console.log(`  Approved problemBank items: ${countApproved(pack.problemBank)}`);
    console.log(`  Approved standardsMap entries: ${countApproved(pack.standardsMap)}`);
  });
}

console.log('');
console.log('Index Counts');
console.log('------------');
Object.entries(index).forEach(([bucketName, bucket]) => {
  console.log(`${bucketName}: ${Object.keys(bucket).length}`);
});

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

function countApproved(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((item) => item && item.reviewStatus === APPROVED_STATUS).length;
}
