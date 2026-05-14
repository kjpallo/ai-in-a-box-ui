const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateStandardsBank,
  validateStandardsBankFile
} = require('../lib/standards/validateStandardsBank');
const { validateKnowledgePack } = require('../lib/knowledge/validateKnowledgePack');

const exampleBankPath = path.join(
  __dirname,
  '..',
  'knowledge',
  'standards-banks',
  '_example',
  'standards_bank.json'
);

const exampleBank = JSON.parse(fs.readFileSync(exampleBankPath, 'utf8'));
const validResult = validateStandardsBankFile(exampleBankPath);
assert.equal(validResult.valid, true, validResult.errors.join('\n'));

const unsafeBankIdResult = validateStandardsBank({
  ...makeMinimalBank(),
  standardsBankId: '../not-safe'
});
assert.equal(unsafeBankIdResult.valid, false);
assert.ok(
  unsafeBankIdResult.errors.some((error) => error.includes('safe for filenames')),
  'unsafe standardsBankId should be rejected'
);

const duplicateStandardIdResult = validateStandardsBank({
  ...makeMinimalBank(),
  standards: [
    makeMinimalStandard('SAMPLE.PS.FORCES.1'),
    makeMinimalStandard('SAMPLE.PS.FORCES.1')
  ]
});
assert.equal(duplicateStandardIdResult.valid, false);
assert.ok(
  duplicateStandardIdResult.errors.some((error) => error.includes('unique within the standards bank')),
  'duplicate standardIds should be rejected'
);

const invalidReviewStatusResult = validateStandardsBank({
  ...makeMinimalBank(),
  standards: [
    {
      ...makeMinimalStandard('SAMPLE.PS.FORCES.1'),
      reviewStatus: 'teacher_maybe'
    }
  ]
});
assert.equal(invalidReviewStatusResult.valid, false);
assert.ok(
  invalidReviewStatusResult.errors.some((error) => error.includes('reviewStatus')),
  'invalid reviewStatus should be rejected'
);

const missingArraysResult = validateStandardsBank({
  ...makeMinimalBank(),
  standards: [
    {
      ...makeMinimalStandard('SAMPLE.PS.FORCES.1'),
      keywords: 'force'
    }
  ]
});
assert.equal(missingArraysResult.valid, false);
assert.ok(
  missingArraysResult.errors.some((error) => error.includes('keywords must be an array')),
  'keywords should be an array'
);

const missingDraftSourceResult = validateStandardsBank({
  ...makeMinimalBank(),
  standards: [
    {
      ...makeMinimalStandard('SAMPLE.PS.FORCES.1'),
      reviewStatus: 'pending',
      sourceFile: '',
      sourceLocation: '',
      sourceTextSnippet: ''
    }
  ]
});
assert.equal(missingDraftSourceResult.valid, false);
assert.ok(
  missingDraftSourceResult.errors.some((error) => error.includes('sourceFile')),
  'pending standards should require source tracking'
);

const knownReferenceResult = validateKnowledgePack(makeMinimalPack(), {
  standardsBank: exampleBank
});
assert.equal(knownReferenceResult.valid, true, knownReferenceResult.errors.join('\n'));

const unknownReferenceResult = validateKnowledgePack({
  ...makeMinimalPack(),
  vocabulary: [
    {
      term: 'mystery force',
      aliases: [],
      standards: ['SAMPLE.PS.UNKNOWN.1'],
      reviewStatus: 'approved',
      confidence: 'high',
      sourceFile: 'sample.pdf',
      sourceLocation: 'p. 1',
      sourceTextSnippet: 'Mystery force.'
    }
  ]
}, {
  standardsBank: exampleBank
});
assert.equal(unknownReferenceResult.valid, false);
assert.ok(
  unknownReferenceResult.errors.some((error) => error.includes('unknown standard reference')),
  'knowledge pack validation should reject unknown standards when a bank is provided'
);

function makeMinimalBank() {
  return {
    standardsBankId: 'minimal_standards_bank',
    title: 'Minimal Standards Bank',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    jurisdiction: 'Local Sample',
    sourceFiles: [],
    standards: [makeMinimalStandard('SAMPLE.PS.FORCES.1')],
    metadata: {}
  };
}

function makeMinimalStandard(standardId) {
  return {
    standardId,
    code: standardId,
    title: 'Balanced and Unbalanced Forces',
    officialText: 'Describe how balanced and unbalanced forces affect motion.',
    studentFriendlyText: 'I can explain how balanced and unbalanced forces change motion.',
    strand: 'Physical Science',
    topic: 'Forces and Motion',
    keywords: ['balanced forces'],
    questionTriggers: ['net force'],
    prerequisiteStandards: [],
    relatedStandards: [],
    reviewStatus: 'approved',
    confidence: 'high',
    sourceFile: 'sample_standards_source.pdf',
    sourceLocation: 'p. 1',
    sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
  };
}

function makeMinimalPack() {
  return {
    packId: 'minimal-pack',
    title: 'Minimal Pack',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [
      {
        term: 'net force',
        aliases: [],
        standards: ['SAMPLE.PS.FORCES.1'],
        reviewStatus: 'approved',
        confidence: 'high',
        sourceFile: 'sample.pdf',
        sourceLocation: 'p. 1',
        sourceTextSnippet: 'Net force.'
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        description: 'Describe how balanced and unbalanced forces affect motion.',
        reviewStatus: 'approved',
        confidence: 'high'
      }
    ],
    smokeTests: [],
    metadata: {}
  };
}

console.log('Standards bank validation tests passed.');
