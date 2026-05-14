const assert = require('node:assert/strict');
const path = require('node:path');

const {
  validateKnowledgePack,
  validateKnowledgePackFile
} = require('../lib/knowledge/validateKnowledgePack');

const examplePackPath = path.join(
  __dirname,
  '..',
  'knowledge',
  'approved-packs',
  '_example',
  'knowledge_pack.json'
);

const validResult = validateKnowledgePackFile(examplePackPath);
assert.equal(validResult.valid, true, validResult.errors.join('\n'));

const unsafePackIdResult = validateKnowledgePack({
  ...makeMinimalPack(),
  packId: '../not-safe'
});
assert.equal(unsafePackIdResult.valid, false);
assert.ok(
  unsafePackIdResult.errors.some((error) => error.includes('safe for filenames')),
  'unsafe packId should be rejected'
);

const formulaSolverClaimResult = validateKnowledgePack({
  ...makeMinimalPack(),
  referenceFormulas: [
    {
      formulaId: 'uploaded-force',
      title: 'Uploaded Force Formula',
      equation: 'F = m * a',
      variables: [],
      studentExplanation: 'Force depends on mass and acceleration.',
      solverStatus: 'science_formula_rules',
      reviewStatus: 'pending',
      confidence: 'medium',
      sourceFile: 'teacher_upload.pdf',
      sourceLocation: 'p. 4',
      sourceTextSnippet: 'Force equals mass times acceleration.'
    }
  ]
});
assert.equal(formulaSolverClaimResult.valid, false);
assert.ok(
  formulaSolverClaimResult.errors.some((error) => error.includes('cannot claim solver support')),
  'uploaded formulas should not claim solver support'
);

const missingSmokeExpectationResult = validateKnowledgePack({
  ...makeMinimalPack(),
  smokeTests: [
    {
      question: 'What is velocity?',
      reviewStatus: 'approved',
      confidence: 'high'
    }
  ]
});
assert.equal(missingSmokeExpectationResult.valid, false);
assert.ok(
  missingSmokeExpectationResult.errors.some((error) => error.includes('expectedAnswer or expectedRoute')),
  'smoke tests should require expectedAnswer or expectedRoute'
);

const missingSourceTrackingResult = validateKnowledgePack({
  ...makeMinimalPack(),
  vocabulary: [
    {
      term: 'velocity',
      aliases: [],
      studentDefinition: 'Speed with direction.',
      teacherDefinition: 'Displacement over time.',
      misconception: '',
      exampleQuestion: '',
      exampleAnswer: '',
      standards: [],
      reviewStatus: 'pending',
      confidence: 'medium'
    }
  ]
});
assert.equal(missingSourceTrackingResult.valid, false);
assert.ok(
  missingSourceTrackingResult.errors.some((error) => error.includes('sourceFile')),
  'pending uploaded-style items should require source tracking'
);

function makeMinimalPack() {
  return {
    packId: 'minimal-pack',
    title: 'Minimal Pack',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [],
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: [],
    metadata: {}
  };
}

console.log('Knowledge pack validation tests passed.');
