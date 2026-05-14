const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildKnowledgePackIndex } = require('../lib/knowledge/buildKnowledgePackIndex');
const { loadApprovedKnowledgePacks } = require('../lib/knowledge/loadApprovedKnowledgePacks');
const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');
const {
  listReviewableDraftItems,
  updateDraftItemReviewStatus
} = require('../lib/knowledge/reviewDraftKnowledgePack');
const { extractTextFromFile } = require('../lib/uploads/extractTextFromFile');
const { generateDraftKnowledgePack } = require('../lib/uploads/generateDraftKnowledgePack');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-import-pipeline-dry-run');
const sourceDir = path.join(tempRoot, 'source-files');
const extractionDir = path.join(tempRoot, 'extractions');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const realApprovedPacksDir = path.join(projectRoot, 'knowledge', 'approved-packs');
const sourcePath = path.join(sourceDir, 'teacher_force_notes.txt');
const extractionJsonPath = path.join(extractionDir, 'teacher_force_notes_extraction.json');
const standardsBank = makeStandardsBank();

cleanupTempRoot();
fs.mkdirSync(sourceDir, { recursive: true });
fs.mkdirSync(extractionDir, { recursive: true });
fs.mkdirSync(draftPacksDir, { recursive: true });
fs.mkdirSync(approvedPacksDir, { recursive: true });

const approvedPacksBefore = snapshotFiles(realApprovedPacksDir);
const routerStudentFilesBefore = snapshotRouterAndStudentFiles();

main().catch((error) => {
  cleanupTempRoot();
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  try {
    console.log('DRY RUN: extraction -> draft generation -> review approval simulation -> promotion -> approved loader/index');

    writeTeacherSourceFile();

    console.log('DRY RUN: extraction');
    const extraction = await extractTextFromFile(sourcePath);
    assert.equal(extraction.success, true, extraction.errors.join('\n'));
    assert.ok(extraction.text.includes('Force is a push or pull.'));
    fs.writeFileSync(extractionJsonPath, `${JSON.stringify(extraction, null, 2)}\n`);

    console.log('DRY RUN: draft generation with mocked modelClient');
    const modelCalls = [];
    const draftResult = await generateDraftKnowledgePack({
      extractionJsonPath,
      standardsBank,
      outputDraftDir: draftPacksDir,
      modelClient: async (options) => {
        modelCalls.push(options);
        return JSON.stringify(makeMockModelPack());
      }
    });

    assert.equal(draftResult.success, true, draftResult.errors.join('\n'));
    assert.equal(draftResult.validationPassed, true);
    assert.equal(modelCalls.length, 1);
    assert.ok(fs.existsSync(draftResult.outputPath));
    assert.ok(draftResult.outputPath.startsWith(draftPacksDir));

    const generatedDraft = readJson(draftResult.outputPath);
    assert.equal(generatedDraft.referenceFormulas[0].solverStatus, 'reference_only');
    assertReviewStatus(generatedDraft, 'pending');

    console.log('DRY RUN: review approval simulation');
    const reviewList = listReviewableDraftItems(draftResult.packId, {
      draftPacksDir,
      validationOptions: { standardsBank }
    });
    assert.equal(reviewList.success, true, reviewList.errors.join('\n'));
    assert.equal(reviewList.items.length, 6);

    reviewList.items.forEach((item) => {
      const result = updateDraftItemReviewStatus(
        draftResult.packId,
        item.section,
        item.index,
        'approved',
        {
          draftPacksDir,
          validationOptions: { standardsBank }
        }
      );
      assert.equal(result.success, true, result.errors.join('\n'));
    });

    const reviewedDraft = readJson(draftResult.outputPath);
    assertReviewStatus(reviewedDraft, 'approved');
    assertSourceTrackingSurvived(reviewedDraft);
    assert.equal(reviewedDraft.referenceFormulas[0].solverStatus, 'reference_only');

    console.log('DRY RUN: promotion to temporary approved-packs');
    const promotion = promoteDraftKnowledgePack(draftResult.packId, {
      draftPacksDir,
      approvedPacksDir,
      standardsBank
    });
    assert.equal(promotion.success, true, promotion.errors.join('\n'));
    assert.equal(promotion.validationPassed, true);
    assert.ok(promotion.outputPath.startsWith(approvedPacksDir));

    const promotedPack = readJson(promotion.outputPath);
    assertReviewStatus(promotedPack, 'approved');
    assertSourceTrackingSurvived(promotedPack);
    assert.equal(promotedPack.referenceFormulas[0].solverStatus, 'reference_only');

    console.log('DRY RUN: approved loader/index');
    const loadResult = loadApprovedKnowledgePacks({
      approvedPacksDir,
      validationOptions: { standardsBank }
    });
    assert.equal(loadResult.errors.length, 0, loadResult.errors.map((error) => error.errors.join('\n')).join('\n'));
    assert.equal(loadResult.packs.length, 1);
    assert.equal(loadResult.packs[0].packId, 'dry-run-force-pack');

    const index = buildKnowledgePackIndex(loadResult.packs);
    assert.ok(index.vocabularyByTerm.force);
    assert.ok(index.conceptsByTitle['net force changes motion']);
    assert.ok(index.problemBankByQuestion['what is a force?']);
    assert.ok(index.standardsMapByStandardId['sample.ps.forces.1']);

    assert.deepEqual(snapshotFiles(realApprovedPacksDir), approvedPacksBefore, 'real knowledge/approved-packs should not be modified');
    assert.deepEqual(snapshotRouterAndStudentFiles(), routerStudentFilesBefore, 'router/student files should not be touched');
    assertNoRouterOrStudentModulesImported();

    console.log(`DRY RUN: temp root ${tempRoot}`);
    console.log('Import pipeline dry-run test passed.');
  } finally {
    cleanupTempRoot();
  }
}

function writeTeacherSourceFile() {
  fs.writeFileSync(sourcePath, [
    'Force is a push or pull.',
    'Net force can change motion.',
    'The reference formula F = m * a relates force, mass, and acceleration.',
    'Balanced and unbalanced forces affect how objects move.'
  ].join('\n'));
}

function assertReviewStatus(pack, reviewStatus) {
  [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'standardsMap',
    'smokeTests'
  ].forEach((sectionName) => {
    assert.ok(Array.isArray(pack[sectionName]), `${sectionName} should be an array`);
    assert.ok(pack[sectionName].length > 0, `${sectionName} should not be empty`);
    pack[sectionName].forEach((item, index) => {
      assert.equal(item.reviewStatus, reviewStatus, `${sectionName}[${index}] reviewStatus`);
    });
  });
}

function assertSourceTrackingSurvived(pack) {
  [
    ...pack.vocabulary,
    ...pack.concepts,
    ...pack.referenceFormulas,
    ...pack.problemBank
  ].forEach((item) => {
    assert.equal(item.sourceFile, 'teacher_force_notes.txt');
    assert.equal(item.sourceLocation, 'Full Text');
    assert.ok(String(item.sourceTextSnippet || '').trim().length > 0);
  });
}

function assertNoRouterOrStudentModulesImported() {
  const importedPaths = Object.keys(require.cache).map((filePath) => path.relative(projectRoot, filePath));
  const forbidden = importedPaths.filter((filePath) => {
    return filePath.startsWith('lib/router/')
      || filePath === 'lib/questionRouter.js'
      || filePath.startsWith('routes/student')
      || filePath === 'lib/server/questionAnswerService.js';
  });

  assert.deepEqual(forbidden, [], `dry-run should not import router/student modules: ${forbidden.join(', ')}`);
}

function snapshotRouterAndStudentFiles() {
  const files = walkFiles(projectRoot).filter((filePath) => {
    const relativePath = path.relative(projectRoot, filePath);
    return relativePath.startsWith('lib/router/')
      || relativePath === 'lib/questionRouter.js'
      || relativePath.startsWith('routes/student')
      || relativePath === 'lib/server/questionAnswerService.js';
  });

  const snapshot = {};
  files.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    snapshot[path.relative(projectRoot, filePath)] = {
      size: stat.size,
      mtimeMs: stat.mtimeMs
    };
  });
  return snapshot;
}

function snapshotFiles(rootDir) {
  const snapshot = {};
  walkFiles(rootDir).forEach((filePath) => {
    snapshot[path.relative(rootDir, filePath)] = fs.readFileSync(filePath, 'utf8');
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeMockModelPack() {
  return {
    packId: 'dry-run-force-pack',
    title: 'Dry Run Force Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'pending',
        confidence: 'medium',
        notes: 'Mocked model output for backend dry-run testing.'
      }
    ],
    vocabulary: [
      {
        term: 'force',
        aliases: ['push or pull'],
        studentDefinition: 'A force is a push or pull.',
        teacherDefinition: 'A force is an interaction that can change motion.',
        misconception: 'A force does not always make something move.',
        standards: ['SAMPLE.PS.FORCES.1'],
        reviewStatus: 'pending',
        confidence: 'medium',
        sourceFile: 'teacher_force_notes.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'Force is a push or pull.'
      }
    ],
    concepts: [
      {
        conceptId: 'net-force-changes-motion',
        title: 'Net Force Changes Motion',
        aliases: ['unbalanced force changes motion'],
        studentExplanation: 'A net force can change how an object moves.',
        keyIdeas: ['Net force can change motion.'],
        examples: ['A stronger push from one side changes motion.'],
        nonExamples: ['Equal pushes from opposite sides do not change motion.'],
        commonMisconceptions: ['Balanced forces mean no forces exist.'],
        standards: ['SAMPLE.PS.FORCES.1'],
        reviewStatus: 'pending',
        confidence: 'medium',
        sourceFile: 'teacher_force_notes.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'Net force can change motion.'
      }
    ],
    referenceFormulas: [
      {
        formulaId: 'force-reference',
        title: 'Force Reference',
        equation: 'F = m * a',
        variables: [
          { symbol: 'F', meaning: 'force' },
          { symbol: 'm', meaning: 'mass' },
          { symbol: 'a', meaning: 'acceleration' }
        ],
        solverStatus: 'reference_only',
        reviewStatus: 'pending',
        confidence: 'medium',
        sourceFile: 'teacher_force_notes.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'The reference formula F = m * a relates force, mass, and acceleration.'
      }
    ],
    problemBank: [
      {
        problemId: 'force-definition-problem',
        question: 'What is a force?',
        expectedAnswer: 'A force is a push or pull.',
        standards: ['SAMPLE.PS.FORCES.1'],
        reviewStatus: 'pending',
        confidence: 'medium',
        sourceFile: 'teacher_force_notes.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'Force is a push or pull.'
      }
    ],
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
      createdBy: 'mock-model-client',
      createdAt: '2026-05-14T00:00:00.000Z',
      dryRun: true
    }
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
        keywords: ['force', 'net force'],
        questionTriggers: ['force', 'net force'],
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
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
