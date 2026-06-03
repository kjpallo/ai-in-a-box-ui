const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { loadEnabledApprovedKnowledgeItems } = require('../lib/knowledge/loadEnabledApprovedKnowledgeItems');
const { approveCombinedReviewRows } = require('../lib/knowledge/approveCombinedReviewRows');
const { diagnoseApprovedKnowledgePipeline } = require('../lib/knowledge/diagnoseApprovedKnowledgePipeline');
const { loadTeacherKnowledge, findRelevantKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');

const projectRoot = path.join(__dirname, '..');
const tempRoot = path.join(projectRoot, 'tmp', 'test-enabled-approved-knowledge-items');
const approvedPacksDir = path.join(tempRoot, 'approved-packs');
const draftPacksDir = path.join(tempRoot, 'draft-packs');
const teacherFactsFile = path.join(tempRoot, 'teacher_facts.json');

cleanupTempRoot();
fs.mkdirSync(approvedPacksDir, { recursive: true });
fs.mkdirSync(draftPacksDir, { recursive: true });

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  try {
    seedTeacherFacts();
    seedApprovedAndDraftPacks();

    const enabledItems = loadEnabledApprovedKnowledgeItems({ approvedPacksDir });
    assert.ok(Array.isArray(enabledItems) && enabledItems.length > 0, 'enabled approved items should load');

    const dnaItem = enabledItems.find((item) => item.title === 'DNA');
    assert.ok(dnaItem, 'enabled approved vocabulary term DNA should load');
    assert.equal(dnaItem.category, 'approved_vocabulary');
    assert.ok(dnaItem.terms.includes('DNA'), 'DNA terms should include the term itself');
    assert.equal(dnaItem.fact, 'DNA is a molecule that stores genetic instructions.');
    assert.match(dnaItem.source, /Approved pack:/);
    assert.match(dnaItem.source, /source_file_a.pdf/i);
    assert.match(dnaItem.source, /p\. 2/i);

    assert.equal(
      enabledItems.some((item) => item.title === 'RNA'),
      false,
      'disabled approved pack items should not load'
    );
    assert.equal(
      enabledItems.some((item) => item.title === 'FixtureTerm'),
      false,
      'underscore fixture approved packs should stay ignored by default'
    );
    assert.equal(
      enabledItems.some((item) => item.title === 'DraftDNA'),
      false,
      'draft packs should never be loaded via approved pack loader'
    );

    const dnaMatches = findRelevantKnowledge('What is DNA?', enabledItems, 6);
    assert.ok(dnaMatches.length > 0, 'findRelevantKnowledge should match enabled approved DNA item');
    assert.ok(dnaMatches.some((item) => item.title === 'DNA'));

    const combinedKnowledge = [
      ...loadTeacherKnowledge(teacherFactsFile),
      ...enabledItems
    ];

    const massMatches = findRelevantKnowledge('What is mass?', combinedKnowledge, 6);
    assert.ok(massMatches.some((item) => item.title === 'Mass'), 'teacher_facts items should still work');

    const dnaRoute = routeStudentQuestion(
      'What is DNA?',
      [dnaMatches.find((item) => item.title === 'DNA') || dnaMatches[0]]
    );
    assert.equal(dnaRoute.type, 'definition', 'DNA question should route as a definition when knowledge matches');
    assert.match(dnaRoute.directAnswer, /In 9th-grade science, DNA is a molecule that stores genetic instructions\./);
    assert.doesNotMatch(dnaRoute.directAnswer, /I do not have a trusted local fact/i);

    await assertSelectedApprovalWorkflowCreatesEnabledStudentKnowledge();
    await assertRealContentSmokeApprovalScenarios();
    await assertHotReloadBehavior();
  } finally {
    cleanupTempRoot();
  }

  console.log('Enabled approved knowledge item tests passed.');
}

async function assertSelectedApprovalWorkflowCreatesEnabledStudentKnowledge() {
  const workflowRoot = path.join(tempRoot, 'selected-approval-workflow');
  const workflowApprovedPacksDir = path.join(workflowRoot, 'approved-packs');
  const workflowDraftPacksDir = path.join(workflowRoot, 'draft-packs');
  const workflowTeacherFactsFile = path.join(workflowRoot, 'teacher_facts.json');
  fs.mkdirSync(workflowApprovedPacksDir, { recursive: true });
  fs.mkdirSync(workflowDraftPacksDir, { recursive: true });
  fs.writeFileSync(workflowTeacherFactsFile, `${JSON.stringify({ items: [] }, null, 2)}\n`);

  const draftPackId = 'dna-protein-synthesis-af2fbfc2a3';
  writePack(workflowDraftPacksDir, makePack({
    packId: draftPackId,
    title: 'DNA Protein Synthesis',
    vocabulary: [
      {
        ...makeVocabulary('DNA', 'molecule that stores genetic instructions.', 'pending'),
        confidence: 'low',
        sourceGrounding: {
          status: 'supported',
          termOrTitleFound: true,
          explanationSupported: true
        }
      }
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const approval = approveCombinedReviewRows({
    mode: 'selected',
    reviewBatchName: 'DNA Protein Synthesis',
    reviewBatchPackIds: [draftPackId],
    rows: [{ draftPackId, section: 'vocabulary', index: 0 }]
  }, {
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir
  });

  assert.equal(approval.success, true, JSON.stringify(approval));
  assert.equal(approval.activation.activationEnabled, true);
  assert.equal(fs.existsSync(approval.combinedPack.outputPath), true, 'selected approval should write a durable approved pack file.');

  const activationState = JSON.parse(fs.readFileSync(path.join(workflowApprovedPacksDir, '_activation.json'), 'utf8'));
  assert.equal(activationState.packs[approval.combinedPack.packId].enabled, true, 'selected approval should enable activation.');
  assert.equal(fs.existsSync(path.join(workflowDraftPacksDir, draftPackId, 'knowledge_pack.json')), false, 'accepted draft should leave active draft-packs once approved rows are fully accepted.');
  assert.equal(Array.isArray(approval.archivedDrafts) && approval.archivedDrafts.length === 1, true, 'accepted draft copy should be archived after approval.');
  assert.match(approval.archivedDrafts[0].archivedPath, /draft-packs[/\\]_accepted[/\\]/, 'fully accepted selected draft should archive under _accepted.');
  assert.equal(fs.existsSync(path.join(approval.archivedDrafts[0].archivedPath, 'knowledge_pack.json')), true, 'archived accepted draft should be preserved.');

  const enabledApproved = loadEnabledApprovedKnowledgeItems({ approvedPacksDir: workflowApprovedPacksDir });
  assert.equal(enabledApproved.some((item) => item.title === 'DNA'), true, 'student loader should include the enabled approved DNA item.');

  const loadCombinedKnowledge = () => [
    ...loadTeacherKnowledge(workflowTeacherFactsFile),
    ...loadEnabledApprovedKnowledgeItems({ approvedPacksDir: workflowApprovedPacksDir })
  ];
  const questionAnswer = createQuestionAnswerService({
    teacherFactsFile: workflowTeacherFactsFile,
    maxKnowledgeItems: 6,
    loadTeacherKnowledge: loadCombinedKnowledge,
    findRelevantKnowledge,
    routeStudentQuestion,
    ollama: {
      async stream() {
        throw new Error('Selected approval workflow should not need AI fallback.');
      },
      buildTeacherPrompt() {
        return '';
      }
    },
    logProblem() {},
    logStudentInteraction() {},
    initialTeacherKnowledge: loadCombinedKnowledge()
  });

  const answer = await questionAnswer.answerStudentMessage('what is dna');
  assert.equal(answer.routeType, 'definition');
  assert.equal(answer.confidence, 'strong');
  assert.match(answer.response, /In 9th-grade science, DNA is a molecule that stores genetic instructions\./);
}

async function assertRealContentSmokeApprovalScenarios() {
  const workflowRoot = path.join(tempRoot, 'real-content-smoke-workflow');
  const workflowApprovedPacksDir = path.join(workflowRoot, 'approved-packs');
  const workflowDraftPacksDir = path.join(workflowRoot, 'draft-packs');
  fs.mkdirSync(workflowApprovedPacksDir, { recursive: true });
  fs.mkdirSync(workflowDraftPacksDir, { recursive: true });

  const cleanPackId = 'smoke-clean-dna-protein-synthesis';
  writePack(workflowDraftPacksDir, makePack({
    packId: cleanPackId,
    title: 'DNA Protein Synthesis Vocabulary',
    sourceFiles: [makeSourceFile('dna-protein-synthesis-vocab.txt', 'txt')],
    vocabulary: [
      {
        ...makeVocabulary('DNA', 'molecule that stores genetic instructions for living things.', 'pending', ['deoxyribonucleic acid']),
        sourceFile: 'dna-protein-synthesis-vocab.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'DNA: A molecule that stores genetic instructions for living things.',
        confidence: 'low',
        sourceGrounding: {
          status: 'supported',
          termOrTitleFound: true,
          explanationSupported: true
        }
      },
      {
        ...makeVocabulary('Ribosome', 'cell structure where proteins are assembled during translation.', 'pending'),
        sourceFile: 'dna-protein-synthesis-vocab.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'Ribosome: The cell structure where proteins are assembled during translation.'
      }
    ],
    concepts: [
      {
        ...makeConcept('Protein synthesis', 'Cells use transcription and translation to build proteins from genetic instructions.', 'pending'),
        sourceFile: 'dna-protein-synthesis-vocab.txt',
        sourceLocation: 'Full Text',
        sourceTextSnippet: 'Protein synthesis: Cells use transcription and translation to build proteins from genetic instructions.'
      }
    ],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));

  const cleanApproval = approveScenario({
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir,
    draftPackId: cleanPackId,
    reviewBatchName: 'Smoke Clean DNA Protein Synthesis',
    rows: [
      { draftPackId: cleanPackId, section: 'vocabulary', index: 0 },
      { draftPackId: cleanPackId, section: 'concepts', index: 0 }
    ]
  });
  const cleanPack = readPack(workflowApprovedPacksDir, cleanApproval.combinedPack.packId);
  const approvedDna = cleanPack.vocabulary.find((item) => item.term === 'DNA');
  assert.ok(approvedDna, 'clean vocabulary row should be approved.');
  assert.equal(approvedDna.teacherVerified, true, 'low-confidence clean row should be teacher verified when selected.');
  assert.equal(approvedDna.sourceTextSnippet, 'DNA: A molecule that stores genetic instructions for living things.');
  assert.equal(cleanPack.vocabulary.some((item) => item.term === 'Ribosome'), false, 'unselected clean vocabulary row should remain out of student knowledge.');
  assert.equal(readPack(workflowDraftPacksDir, cleanPackId).vocabulary.some((item) => item.term === 'Ribosome'), true, 'unselected clean row should stay in the active draft.');
  assertApprovedRouteReady({
    approvedPacksDir: workflowApprovedPacksDir,
    packId: cleanApproval.combinedPack.packId,
    question: 'what is dna',
    answerPattern: /DNA is a molecule that stores genetic instructions for living things\./
  });

  const messyPackId = 'smoke-messy-slide-export';
  writePack(workflowDraftPacksDir, makePack({
    packId: messyPackId,
    title: 'Messy Slide Export',
    sourceFiles: [makeSourceFile('messy-slide-export.pdf', 'pdf')],
    vocabulary: [],
    concepts: [
      {
        ...makeConcept('Translation', 'Translation happens at ribosomes, where tRNA brings amino acids in the correct order.', 'pending'),
        sourceFile: 'messy-slide-export.pdf',
        sourceLocation: 'Slide 2',
        sourceTextSnippet: 'Translation happens at ribosomes. tRNA brings amino acids to the ribosome in the correct order.'
      }
    ],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
  const messyApproval = approveScenario({
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir,
    draftPackId: messyPackId,
    reviewBatchName: 'Smoke Messy Slide Export',
    rows: [{ draftPackId: messyPackId, section: 'concepts', index: 0 }]
  });
  const messyPack = readPack(workflowApprovedPacksDir, messyApproval.combinedPack.packId);
  assert.equal(messyPack.concepts[0].sourceLocation, 'Slide 2');
  assert.match(messyPack.concepts[0].sourceTextSnippet, /tRNA brings amino acids/);
  assertApprovedRouteReady({
    approvedPacksDir: workflowApprovedPacksDir,
    packId: messyApproval.combinedPack.packId,
    question: 'explain translation',
    answerPattern: /Translation happens at ribosomes/
  });

  const physicalPackId = 'smoke-physical-science-formulas';
  writePack(workflowDraftPacksDir, makePack({
    packId: physicalPackId,
    title: 'Physical Science Vocabulary and Reference Formulas',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [makeSourceFile('physical-science-reference-formulas.txt', 'txt')],
    vocabulary: [
      {
        ...makeVocabulary('Density', 'amount of mass in a given volume.', 'pending'),
        standards: [],
        sourceFile: 'physical-science-reference-formulas.txt',
        sourceLocation: 'Vocabulary',
        sourceTextSnippet: 'Density: The amount of mass in a given volume.'
      }
    ],
    concepts: [],
    referenceFormulas: [
      makeReferenceFormula({
        formulaId: 'density-reference',
        title: 'Density reference',
        equation: 'density = mass / volume',
        sourceFile: 'physical-science-reference-formulas.txt',
        sourceLocation: 'Reference formulas',
        sourceTextSnippet: 'Density = mass / volume'
      })
    ],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
  const physicalApproval = approveScenario({
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir,
    draftPackId: physicalPackId,
    reviewBatchName: 'Smoke Physical Science Formula References',
    rows: [
      { draftPackId: physicalPackId, section: 'vocabulary', index: 0 },
      { draftPackId: physicalPackId, section: 'referenceFormulas', index: 0 }
    ]
  });
  const physicalPack = readPack(workflowApprovedPacksDir, physicalApproval.combinedPack.packId);
  assert.equal(physicalPack.referenceFormulas[0].solverStatus, 'reference_only', 'uploaded formulas must remain reference-only.');
  const enabledAfterPhysical = loadEnabledApprovedKnowledgeItems({ approvedPacksDir: workflowApprovedPacksDir });
  assert.equal(
    enabledAfterPhysical.some((item) => String(item.id || '').includes(':referenceFormulas:') || item.category === 'approved_reference_formula'),
    false,
    'enabled student knowledge should not expose reference formulas as executable formula items.'
  );
  assertApprovedRouteReady({
    approvedPacksDir: workflowApprovedPacksDir,
    packId: physicalApproval.combinedPack.packId,
    question: 'what is density',
    answerPattern: /Density is an amount of mass in a given volume\./
  });
  const formulaRoute = routeStudentQuestion('A 3 kg cart accelerates at 2 m/s^2. What force is needed?', []);
  assert.equal(formulaRoute.type, 'science_formula', 'existing built-in formula solver behavior should remain unchanged.');
  assert.equal(formulaRoute.confidence, 'strong');

  const worksheetPackId = 'smoke-worksheet-study-guide';
  writePack(workflowDraftPacksDir, makePack({
    packId: worksheetPackId,
    title: 'Cells and Energy Study Guide',
    sourceFiles: [makeSourceFile('study-guide-review-questions.txt', 'txt')],
    vocabulary: [],
    concepts: [],
    referenceFormulas: [],
    problemBank: [
      {
        ...makeProblem('mitochondria-study-guide', 'What organelle releases usable energy from food?', 'Mitochondria release usable energy from food during cellular respiration.', 'pending'),
        sourceFile: 'study-guide-review-questions.txt',
        sourceLocation: 'Review Questions',
        sourceTextSnippet: 'Answer: Mitochondria release usable energy from food during cellular respiration.'
      }
    ],
    standardsMap: [],
    smokeTests: []
  }));
  const worksheetApproval = approveScenario({
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir,
    draftPackId: worksheetPackId,
    reviewBatchName: 'Smoke Worksheet Study Guide',
    rows: [{ draftPackId: worksheetPackId, section: 'problemBank', index: 0 }]
  });
  assertApprovedRouteReady({
    approvedPacksDir: workflowApprovedPacksDir,
    packId: worksheetApproval.combinedPack.packId,
    question: 'What organelle releases usable energy from food?',
    answerPattern: /Mitochondria release usable energy from food during cellular respiration\./
  });

  const junkPackId = 'smoke-junk-fragment-review';
  writePack(workflowDraftPacksDir, makePack({
    packId: junkPackId,
    title: 'Junk Fragment Review',
    sourceFiles: [makeSourceFile('junk-fragments.txt', 'txt')],
    vocabulary: [
      {
        ...makeVocabulary('Codon', 'three-base sequence on mRNA that matches an amino acid during translation.', 'pending'),
        sourceFile: 'junk-fragments.txt',
        sourceLocation: 'Page 1',
        sourceTextSnippet: 'Codon: A three-base sequence on mRNA that matches an amino acid during translation.',
        confidence: 'low',
        sourceGrounding: {
          status: 'supported',
          termOrTitleFound: true,
          explanationSupported: true
        }
      },
      {
        ...makeVocabulary('depending on the', 'depending on the', 'pending'),
        sourceFile: 'junk-fragments.txt',
        sourceLocation: 'Page 2',
        sourceTextSnippet: ''
      },
      {
        ...makeVocabulary('answer', '', 'pending'),
        sourceFile: 'junk-fragments.txt',
        sourceLocation: 'Page 2',
        sourceTextSnippet: 'Answer:',
        repairStatus: 'repair_failed'
      },
      makeVocabulary('discarded fragment', 'fragment row rejected by teacher.', 'rejected')
    ],
    concepts: [],
    referenceFormulas: [],
    problemBank: [],
    standardsMap: [],
    smokeTests: []
  }));
  const junkApproval = approveCombinedReviewRows({
    mode: 'selected',
    reviewBatchName: 'Smoke Junk Fragment Review',
    reviewBatchPackIds: [junkPackId],
    rows: [
      { draftPackId: junkPackId, section: 'vocabulary', index: 0 },
      { draftPackId: junkPackId, section: 'vocabulary', index: 1 },
      { draftPackId: junkPackId, section: 'vocabulary', index: 2 },
      { draftPackId: junkPackId, section: 'vocabulary', index: 3 }
    ]
  }, {
    approvedPacksDir: workflowApprovedPacksDir,
    draftPacksDir: workflowDraftPacksDir
  });
  assert.equal(junkApproval.success, true, JSON.stringify(junkApproval));
  assert.equal(junkApproval.acceptedCount, 1, 'only teacher-verified low-confidence row should be accepted from junk-heavy upload.');
  assert.equal(junkApproval.skipped.blocked, 2, 'real junk blockers should remain blocked.');
  assert.equal(junkApproval.skipped.rejected, 1, 'teacher-rejected junk should stay out.');
  const junkPack = readPack(workflowApprovedPacksDir, junkApproval.combinedPack.packId);
  assert.equal(junkPack.vocabulary.some((item) => item.term === 'Codon'), true);
  assert.equal(junkPack.vocabulary.some((item) => item.term === 'depending on the'), false);
  assert.equal(junkPack.vocabulary.some((item) => item.term === 'answer'), false);
  const remainingJunkDraft = readPack(workflowDraftPacksDir, junkPackId);
  assert.equal(remainingJunkDraft.vocabulary.some((item) => item.term === 'depending on the'), true, 'blocked junk row should remain available for teacher review.');
  assert.equal(remainingJunkDraft.vocabulary.some((item) => item.term === 'answer'), true, 'repair-failed junk row should remain available for teacher action.');
  assertApprovedRouteReady({
    approvedPacksDir: workflowApprovedPacksDir,
    packId: junkApproval.combinedPack.packId,
    question: 'what is codon',
    answerPattern: /Codon is a three-base sequence on mRNA/
  });
  const junkEnabledItems = loadEnabledApprovedKnowledgeItems({ approvedPacksDir: workflowApprovedPacksDir });
  assert.equal(junkEnabledItems.some((item) => item.title === 'depending on the'), false, 'blocked junk row must not become student knowledge.');
  assert.equal(junkEnabledItems.some((item) => item.title === 'answer'), false, 'repair-failed junk row must not become student knowledge.');
}

function approveScenario({ approvedPacksDir, draftPacksDir, draftPackId, reviewBatchName, rows }) {
  const approval = approveCombinedReviewRows({
    mode: 'selected',
    reviewBatchName,
    reviewBatchPackIds: [draftPackId],
    rows
  }, {
    approvedPacksDir,
    draftPacksDir
  });
  assert.equal(approval.success, true, JSON.stringify(approval));
  assert.equal(approval.activation.activationEnabled, true, 'approved pack should be activated immediately.');
  assert.equal(fs.existsSync(approval.combinedPack.outputPath), true, 'approved pack should be durable.');
  return approval;
}

function assertApprovedRouteReady({ approvedPacksDir, packId, question, answerPattern }) {
  const diagnostic = diagnoseApprovedKnowledgePipeline({
    approvedPacksDir,
    packId,
    question,
    findRelevantKnowledge,
    routeStudentQuestion
  });
  assert.equal(diagnostic.ok, true, JSON.stringify(diagnostic, null, 2));
  assert.match(diagnostic.route.directAnswer, answerPattern, JSON.stringify(diagnostic, null, 2));
}

function assertHotReloadBehavior() {
  writeActivationFile({
    version: 1,
    packs: {
      'dna-pack-enabled': { enabled: false, updatedAt: '2026-06-01T00:00:00.000Z' }
    }
  });

  const loadCombinedKnowledge = () => [
    ...loadTeacherKnowledge(teacherFactsFile),
    ...loadEnabledApprovedKnowledgeItems({ approvedPacksDir })
  ];

  const questionAnswer = createQuestionAnswerService({
    teacherFactsFile,
    maxKnowledgeItems: 6,
    loadTeacherKnowledge: loadCombinedKnowledge,
    findRelevantKnowledge,
    routeStudentQuestion,
    ollama: {
      async stream() {
        throw new Error('AI fallback should not be used in approved knowledge loader tests.');
      },
      buildTeacherPrompt() {
        return '';
      }
    },
    logProblem() {},
    logStudentInteraction() {},
    initialTeacherKnowledge: loadCombinedKnowledge()
  });

  return questionAnswer.answerStudentMessage('What is DNA?').then((beforeEnable) => {
    assert.match(beforeEnable.response, /I do not have a trusted local (science )?fact for that yet\./i);

    writeActivationFile({
      version: 1,
      packs: {
        'dna-pack-enabled': { enabled: true, updatedAt: '2026-06-01T00:01:00.000Z' }
      }
    });

    return questionAnswer.answerStudentMessage('What is DNA?').then((afterEnable) => {
      assert.match(afterEnable.response, /In 9th-grade science, DNA is a molecule that stores genetic instructions\./);
      assert.doesNotMatch(afterEnable.response, /I do not have a trusted local science fact/i);
    });
  });
}

function seedTeacherFacts() {
  const facts = {
    items: [
      {
        id: 'mass-definition',
        category: 'reference',
        title: 'Mass',
        terms: ['mass'],
        fact: 'Mass is the amount of matter in an object.',
        source: 'Teacher-created local knowledge base'
      }
    ]
  };

  fs.writeFileSync(teacherFactsFile, `${JSON.stringify(facts, null, 2)}\n`);
}

function seedApprovedAndDraftPacks() {
  writePack(approvedPacksDir, makePack({
    packId: 'dna-pack-enabled',
    title: 'DNA Approved Pack',
    vocabulary: [
      makeVocabulary('DNA', 'molecule that stores genetic instructions.', 'approved', ['Deoxyribonucleic Acid']),
      makeVocabulary('Gene', 'section of DNA with instructions for a trait or protein.', 'approved')
    ],
    concepts: [
      makeConcept('Transcription', 'making RNA from a DNA template.', 'approved')
    ],
    problemBank: [
      makeProblem('dna-problem', 'What is DNA?', 'DNA is the molecule that stores genetic instructions.', 'approved')
    ]
  }));

  writePack(approvedPacksDir, makePack({
    packId: 'dna-pack-disabled',
    title: 'DNA Disabled Pack',
    vocabulary: [
      makeVocabulary('RNA', 'molecule involved in protein synthesis.', 'approved')
    ]
  }));

  writePack(path.join(approvedPacksDir, '_example'), makePack({
    packId: 'fixture-pack',
    title: 'Fixture Pack',
    vocabulary: [makeVocabulary('FixtureTerm', 'fixture definition.', 'approved')]
  }));

  writePack(draftPacksDir, makePack({
    packId: 'draft-only-dna-pack',
    title: 'Draft Only DNA Pack',
    version: '0.1.0-draft',
    vocabulary: [makeVocabulary('DraftDNA', 'draft definition.', 'approved')]
  }));

  writeActivationFile({
    version: 1,
    packs: {
      'dna-pack-enabled': { enabled: true, updatedAt: '2026-06-01T00:00:00.000Z' },
      'dna-pack-disabled': { enabled: false, updatedAt: '2026-06-01T00:00:00.000Z' },
      'fixture-pack': { enabled: true, updatedAt: '2026-06-01T00:00:00.000Z' }
    }
  });
}

function writeActivationFile(payload) {
  fs.writeFileSync(path.join(approvedPacksDir, '_activation.json'), `${JSON.stringify(payload, null, 2)}\n`);
}

function writePack(rootDir, pack) {
  const packDir = path.join(rootDir, pack.packId);
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, 'knowledge_pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
}

function readPack(rootDir, packId) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, packId, 'knowledge_pack.json'), 'utf8'));
}

function makeSourceFile(fileName, fileType) {
  return {
    fileName,
    fileType,
    reviewStatus: 'approved',
    confidence: 'high',
    notes: 'Synthetic teacher-upload smoke fixture.'
  };
}

function makePack(overrides = {}) {
  return {
    packId: 'sample-pack',
    title: 'Sample Pack',
    version: '1.0.0',
    subject: 'Biology',
    gradeLevel: '9',
    sourceFiles: [
      {
        fileName: 'source_file_a.pdf',
        fileType: 'pdf',
        reviewStatus: 'approved',
        confidence: 'high'
      }
    ],
    vocabulary: [makeVocabulary('DefaultTerm', 'default definition.', 'approved')],
    concepts: [makeConcept('Default Concept', 'default explanation.', 'approved')],
    referenceFormulas: [],
    problemBank: [makeProblem('default-problem', 'Default question?', 'Default answer.', 'approved')],
    standardsMap: [makeStandard('BIO.DNA.1', 'approved')],
    smokeTests: [makeSmokeTest('approved')],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z'
    },
    ...overrides
  };
}

function makeVocabulary(term, studentDefinition, reviewStatus, aliases = []) {
  return {
    term,
    aliases,
    studentDefinition,
    teacherDefinition: `${term} teacher definition.`,
    misconception: `${term} misconception.`,
    exampleQuestion: `What is ${term}?`,
    exampleAnswer: `${term} example answer.`,
    standards: ['BIO.DNA.1'],
    reviewStatus,
    confidence: 'high',
    sourceFile: 'source_file_a.pdf',
    sourceLocation: 'p. 2',
    sourceTextSnippet: `${term} source snippet.`
  };
}

function makeConcept(title, studentExplanation, reviewStatus) {
  return {
    conceptId: normalizeId(title),
    title,
    aliases: [],
    studentExplanation,
    keyIdeas: [studentExplanation],
    examples: [`${title} example`],
    nonExamples: [`${title} non-example`],
    commonMisconceptions: [`${title} misconception`],
    standards: ['BIO.DNA.1'],
    reviewStatus,
    confidence: 'high',
    sourceFile: 'source_file_a.pdf',
    sourceLocation: 'p. 3',
    sourceTextSnippet: `${title} source snippet.`
  };
}

function makeProblem(problemId, question, expectedAnswer, reviewStatus) {
  return {
    problemId,
    question,
    expectedAnswer,
    standards: ['BIO.DNA.1'],
    reviewStatus,
    confidence: 'high',
    sourceFile: 'source_file_a.pdf',
    sourceLocation: 'p. 4',
    sourceTextSnippet: `${problemId} source snippet.`
  };
}

function makeReferenceFormula(overrides = {}) {
  return {
    formulaId: 'reference-formula',
    title: 'Reference Formula',
    equation: 'value = numerator / denominator',
    variables: [],
    solverStatus: 'reference_only',
    standards: [],
    reviewStatus: 'pending',
    confidence: 'medium',
    sourceFile: 'source_file_a.pdf',
    sourceLocation: 'p. 5',
    sourceTextSnippet: 'Reference formula source snippet.',
    ...overrides
  };
}

function makeStandard(standardId, reviewStatus) {
  return {
    standardId,
    description: 'Describe DNA structure and function.',
    relatedVocabulary: ['DNA'],
    relatedConcepts: ['transcription'],
    reviewStatus,
    confidence: 'high'
  };
}

function makeSmokeTest(reviewStatus) {
  return {
    question: 'What is DNA?',
    expectedAnswer: 'DNA stores genetic instructions.',
    reviewStatus,
    confidence: 'high'
  };
}

function normalizeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function cleanupTempRoot() {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
