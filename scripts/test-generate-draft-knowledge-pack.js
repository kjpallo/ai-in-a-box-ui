const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');
const { buildKnowledgePackPrompt } = require('../lib/uploads/buildKnowledgePackPrompt');
const { generateDraftKnowledgePack } = require('../lib/uploads/generateDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-draft-pack-'));
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const extractionPath = path.join(tempRoot, 'example_extraction.json');
const standardsBankPath = path.join(tempRoot, 'standards_bank.json');
const rawModelResponsesDir = path.join(tempRoot, 'model-responses');
const approvedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const approvedPacksBefore = snapshotApprovedPacks();

main().catch((error) => {
  cleanupTempRoot();
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  fs.mkdirSync(draftPacksDir, { recursive: true });
  fs.writeFileSync(extractionPath, `${JSON.stringify(makeExtraction(), null, 2)}\n`);
  fs.writeFileSync(standardsBankPath, `${JSON.stringify(makeStandardsBank(), null, 2)}\n`);

  try {
    assertPromptIncludesControls();
    assertPromptIncludesStandardsList();
    await assertValidMockCreatesDraft();
    await assertCodeFencedJsonCreatesDraft();
    await assertExtraTextAroundJsonCreatesDraftWhenUnambiguous();
    await assertMissingMetadataIsNormalizedAndValidates();
    await assertMissingTopLevelArraysAreNormalizedAndValidate();
    await assertVocabularyReviewStatusIsNormalized();
    await assertFormulaSolverStatusIsNormalized();
    await assertConceptStructuralFieldsAreNormalized();
    await assertRequiredFactFieldsAreStillRejected();
    await assertInvalidMockJsonReturnsUsefulError();
    await assertRetryInvalidJsonCanRepairDraft();
    await assertInvalidStandardsAreRejected();
    assertApprovedPacksAreNotModified();
  } finally {
    cleanupTempRoot();
  }

  console.log('Draft knowledge pack generation tests passed.');
}

function assertPromptIncludesControls() {
  const prompt = buildKnowledgePackPrompt({
    extraction: makeExtraction()
  });

  assert.ok(prompt.includes('Do not invent facts.'));
  assert.ok(prompt.includes('Do not invent standards.'));
  assert.ok(prompt.includes('solverStatus: "reference_only"'));
  assert.ok(prompt.includes('Do not create solver code.'));
  assert.ok(prompt.includes('Return valid JSON only.'));
  assert.ok(prompt.includes('Return one JSON object only.'));
  assert.ok(prompt.includes('Do not use markdown.'));
  assert.ok(prompt.includes('Do not wrap the JSON in triple backticks.'));
  assert.ok(prompt.includes('Escape all quotation marks inside string values.'));
  assert.ok(prompt.includes('Do not include comments or trailing commas.'));
  assert.ok(prompt.includes('"sourceFiles": []'));
  assert.ok(prompt.includes('"referenceFormulas": []'));
  assert.ok(prompt.includes('"problemBank": []'));
  assert.ok(prompt.includes('"standardsMap": []'));
  assert.ok(prompt.includes('"smokeTests": []'));
  assert.ok(prompt.includes('"metadata": {}'));
  assert.ok(prompt.includes('Vocabulary items must use this minimal object shape:'));
  assert.ok(prompt.includes('Concept items must use this minimal object shape:'));
}

function assertPromptIncludesStandardsList() {
  const prompt = buildKnowledgePackPrompt({
    extraction: makeExtraction(),
    standardsBank: makeStandardsBank()
  });

  assert.ok(prompt.includes('Available standards bank:'));
  assert.ok(prompt.includes('SAMPLE.PS.FORCES.1'));
  assert.ok(prompt.includes('You may only use standardIds from the available standards bank above.'));
}

async function assertValidMockCreatesDraft() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    standardsBankPath,
    outputDraftDir: draftPacksDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack())
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-force-draft');
  assert.equal(result.validationPassed, true);
  assert.ok(result.outputPath.endsWith(path.join('generated-force-draft', 'knowledge_pack.json')));

  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.problemBank[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
}

async function assertCodeFencedJsonCreatesDraft() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'code-fenced-drafts'),
    modelClient: async () => `\`\`\`json\n${JSON.stringify(makeGeneratedPack({ packId: 'generated-fenced-draft' }))}\n\`\`\``
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-fenced-draft');
  assert.equal(result.validationPassed, true);
  assert.ok(fs.existsSync(result.outputPath));
}

async function assertExtraTextAroundJsonCreatesDraftWhenUnambiguous() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'extra-text-drafts'),
    modelClient: async () => [
      'Here is the draft JSON:',
      JSON.stringify(makeGeneratedPack({ packId: 'generated-extra-text-draft' })),
      'End.'
    ].join('\n')
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-extra-text-draft');
  assert.equal(result.validationPassed, true);
  assert.ok(fs.existsSync(result.outputPath));
}

async function assertInvalidMockJsonReturnsUsefulError() {
  const outputDraftDir = path.join(tempRoot, 'invalid-json-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => 'not json'
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('Model response was not valid JSON')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  assert.equal(fs.readFileSync(result.rawModelResponsePath, 'utf8'), 'not json');
  assert.equal(fs.existsSync(outputDraftDir), false);
}

async function assertMissingMetadataIsNormalizedAndValidates() {
  const generatedPack = makeGeneratedPack({ packId: 'generated-missing-metadata-draft' });
  delete generatedPack.metadata;

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'missing-metadata-drafts'),
    modelClient: async () => JSON.stringify(generatedPack)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.metadata, {});
}

async function assertMissingTopLevelArraysAreNormalizedAndValidate() {
  const generatedPack = makeGeneratedPack({ packId: 'generated-missing-arrays-draft' });
  delete generatedPack.sourceFiles;
  delete generatedPack.vocabulary;
  delete generatedPack.concepts;
  delete generatedPack.referenceFormulas;
  delete generatedPack.problemBank;
  delete generatedPack.standardsMap;
  delete generatedPack.smokeTests;

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'missing-arrays-drafts'),
    modelClient: async () => JSON.stringify(generatedPack)
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.sourceFiles.length, 1);
  assert.equal(generated.sourceFiles[0].fileName, 'teacher_force_notes.txt');
  assert.deepEqual(generated.vocabulary, []);
  assert.deepEqual(generated.concepts, []);
  assert.deepEqual(generated.referenceFormulas, []);
  assert.deepEqual(generated.problemBank, []);
  assert.deepEqual(generated.standardsMap, []);
  assert.deepEqual(generated.smokeTests, []);
}

async function assertVocabularyReviewStatusIsNormalized() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'vocab-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-vocab-normalized-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          standards: 'SAMPLE.PS.FORCES.1',
          reviewStatus: 'approved',
          confidence: 'certain'
        }
      ]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.vocabulary[0].reviewStatus, 'pending');
  assert.equal(generated.vocabulary[0].confidence, 'low');
  assert.deepEqual(generated.vocabulary[0].standards, []);
}

async function assertFormulaSolverStatusIsNormalized() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'formula-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-formula-normalized-draft',
      referenceFormulas: [
        {
          ...makeReferenceFormula(),
          solverStatus: 'auto_solver',
          reviewStatus: 'approved',
          confidence: 'unknown'
        }
      ]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.equal(generated.referenceFormulas[0].solverStatus, 'reference_only');
  assert.equal(generated.referenceFormulas[0].reviewStatus, 'pending');
  assert.equal(generated.referenceFormulas[0].confidence, 'low');
}

async function assertConceptStructuralFieldsAreNormalized() {
  const concept = makeConceptItem();
  delete concept.keyIdeas;
  delete concept.examples;
  delete concept.nonExamples;
  delete concept.commonMisconceptions;
  delete concept.sourceFile;
  delete concept.sourceLocation;
  delete concept.sourceTextSnippet;
  concept.standards = 'SAMPLE.PS.FORCES.1';
  concept.reviewStatus = 'approved';
  concept.confidence = 'certain';

  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'concept-normalized-drafts'),
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-concept-normalized-draft',
      concepts: [concept]
    }))
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  const generated = JSON.parse(fs.readFileSync(result.outputPath, 'utf8'));
  assert.deepEqual(generated.concepts[0].keyIdeas, []);
  assert.deepEqual(generated.concepts[0].examples, []);
  assert.deepEqual(generated.concepts[0].nonExamples, []);
  assert.deepEqual(generated.concepts[0].commonMisconceptions, []);
  assert.deepEqual(generated.concepts[0].standards, []);
  assert.equal(generated.concepts[0].reviewStatus, 'pending');
  assert.equal(generated.concepts[0].confidence, 'low');
  assert.equal(generated.concepts[0].sourceFile, 'teacher_force_notes.txt');
  assert.equal(generated.concepts[0].sourceLocation, 'extracted text');
  assert.ok(generated.concepts[0].sourceTextSnippet.includes('Force is a push or pull.'));
}

async function assertRequiredFactFieldsAreStillRejected() {
  const outputDraftDir = path.join(tempRoot, 'missing-facts-drafts');
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir,
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-missing-facts-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          term: ''
        }
      ],
      concepts: [
        {
          ...makeConceptItem(),
          title: ''
        }
      ]
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('vocabulary[0].term must be a non-empty string.')));
  assert.ok(result.errors.some((error) => error.includes('concepts[0].title must be a non-empty string.')));
  assert.ok(result.rawModelResponsePath);
  assert.ok(result.rawModelResponsePath.startsWith(rawModelResponsesDir));
  const debug = JSON.parse(fs.readFileSync(result.rawModelResponsePath, 'utf8'));
  assert.equal(debug.normalizedDraftAttempt.vocabulary[0].term, '');
  assert.equal(debug.normalizedDraftAttempt.concepts[0].title, '');
  assert.equal(fs.existsSync(outputDraftDir), false);
}

async function assertRetryInvalidJsonCanRepairDraft() {
  const calls = [];
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    outputDraftDir: path.join(tempRoot, 'retry-drafts'),
    retryInvalidJson: true,
    modelClient: async ({ prompt }) => {
      calls.push(prompt);
      return calls.length === 1
        ? '{"packId":"broken",'
        : JSON.stringify(makeGeneratedPack({ packId: 'generated-retry-draft' }));
    }
  });

  assert.equal(result.success, true, result.errors.join('\n'));
  assert.equal(result.packId, 'generated-retry-draft');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('Convert the following attempted response into valid JSON matching the required schema.'));
  assert.ok(calls[1].includes('Return JSON only. Do not add new facts.'));
}

async function assertInvalidStandardsAreRejected() {
  const result = await generateDraftKnowledgePack({
    extractionJsonPath: extractionPath,
    standardsBankPath,
    outputDraftDir: path.join(tempRoot, 'invalid-standard-drafts'),
    rawModelResponsesDir,
    modelClient: async () => JSON.stringify(makeGeneratedPack({
      packId: 'generated-invalid-standard-draft',
      vocabulary: [
        {
          ...makeVocabularyItem(),
          standards: ['SAMPLE.PS.UNKNOWN.1']
        }
      ],
      standardsMap: [
        {
          standardId: 'SAMPLE.PS.UNKNOWN.1',
          description: 'Invented standard',
          relatedVocabulary: ['force'],
          relatedConcepts: [],
          reviewStatus: 'pending',
          confidence: 'low'
        }
      ]
    }))
  });

  assert.equal(result.success, false);
  assert.equal(result.validationPassed, false);
  assert.ok(result.errors.some((error) => error.includes('unknown standard reference')));
}

function assertApprovedPacksAreNotModified() {
  const loadResult = loadApprovedKnowledgePacks({ approvedPacksDir });
  assert.equal(loadResult.errors.length, 0, loadResult.errors.map((error) => error.errors.join('\n')).join('\n'));
  assert.deepEqual(snapshotApprovedPacks(), approvedPacksBefore, 'approved-packs should not be modified by generation tests');
}

function snapshotApprovedPacks() {
  const snapshot = {};
  walkFiles(approvedPacksDir).forEach((filePath) => {
    snapshot[path.relative(approvedPacksDir, filePath)] = fs.readFileSync(filePath, 'utf8');
  });
  return snapshot;
}

function walkFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  fs.readdirSync(rootDir, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      results.push(entryPath);
    }
  });
  return results.sort();
}

function makeExtraction() {
  return {
    success: true,
    filePath: '/tmp/teacher_force_notes.txt',
    fileName: 'teacher_force_notes.txt',
    extension: '.txt',
    mimeGuess: 'text/plain',
    text: 'Force is a push or pull. Net force can change motion. The formula F = m * a relates force, mass, and acceleration.',
    sections: [
      {
        label: 'Full Text',
        text: 'Force is a push or pull. Net force can change motion. The formula F = m * a relates force, mass, and acceleration.'
      }
    ],
    tables: [],
    metadata: {
      detectedType: 'txt',
      characterCount: 113
    },
    warnings: [],
    errors: []
  };
}

function makeGeneratedPack(overrides = {}) {
  return {
    packId: 'generated-force-draft',
    title: 'Generated Force Draft',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'pending',
        confidence: 'medium',
        notes: 'Generated from extracted text for teacher review.'
      }
    ],
    vocabulary: [makeVocabularyItem()],
    concepts: [makeConceptItem()],
    referenceFormulas: [makeReferenceFormula()],
    problemBank: [makeProblemItem()],
    standardsMap: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        description: 'Describe how balanced and unbalanced forces affect motion.',
        relatedVocabulary: ['force'],
        relatedConcepts: ['net-force-changes-motion'],
        reviewStatus: 'pending',
        confidence: 'medium'
      }
    ],
    smokeTests: [
      {
        question: 'What is force?',
        expectedAnswer: 'Force is a push or pull.',
        reviewStatus: 'pending',
        confidence: 'medium'
      }
    ],
    metadata: {
      createdBy: 'test-model-client',
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:00:00.000Z',
      notes: 'Generated draft. Requires teacher review before promotion.'
    },
    ...overrides
  };
}

function makeVocabularyItem() {
  return {
    term: 'force',
    aliases: ['push or pull'],
    studentDefinition: 'A force is a push or pull.',
    teacherDefinition: 'A force is an interaction that can change motion.',
    misconception: '',
    exampleQuestion: 'What can change motion?',
    exampleAnswer: 'A force can change motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeConceptItem() {
  return {
    conceptId: 'net-force-changes-motion',
    title: 'Net Force Changes Motion',
    aliases: [],
    studentExplanation: 'Net force can change how an object moves.',
    keyIdeas: ['Net force can change motion.'],
    examples: ['A push can start an object moving.'],
    nonExamples: [],
    commonMisconceptions: [],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force can change motion.'
  };
}

function makeReferenceFormula() {
  return {
    formulaId: 'force-reference',
    title: 'Force Reference',
    equation: 'F = m * a',
    variables: [
      {
        symbol: 'F',
        meaning: 'force'
      },
      {
        symbol: 'm',
        meaning: 'mass'
      },
      {
        symbol: 'a',
        meaning: 'acceleration'
      }
    ],
    studentExplanation: 'The formula relates force, mass, and acceleration.',
    solverStatus: 'reference_only',
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'The formula F = m * a relates force, mass, and acceleration.'
  };
}

function makeProblemItem() {
  return {
    problemId: 'force-definition-problem',
    question: 'What is a force?',
    expectedAnswer: 'A force is a push or pull.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Force is a push or pull.'
  };
}

function makeStandardsBank() {
  return {
    standardsBankId: 'sample_physical_science_standards',
    title: 'Sample Physical Science Standards Bank',
    version: '0.1.0',
    subject: 'Physical Science',
    gradeLevel: '8',
    jurisdiction: 'Local Sample',
    sourceFiles: [],
    standards: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        code: 'PS.FORCES.1',
        title: 'Balanced and Unbalanced Forces',
        officialText: 'Describe how balanced and unbalanced forces affect motion.',
        studentFriendlyText: 'I can explain how balanced and unbalanced forces change motion.',
        strand: 'Physical Science',
        topic: 'Forces and Motion',
        keywords: ['balanced forces', 'unbalanced forces', 'net force'],
        questionTriggers: ['balanced forces', 'unbalanced forces', 'net force'],
        prerequisiteStandards: [],
        relatedStandards: [],
        reviewStatus: 'approved',
        confidence: 'high',
        sourceFile: 'sample_standards_source.pdf',
        sourceLocation: 'p. 1',
        sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
      }
    ],
    metadata: {}
  };
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, {
    recursive: true,
    force: true
  });
}
