function makeTeacherContentPack(overrides = {}) {
  return {
    packId: 'route-pack',
    title: 'Route Pack',
    version: '0.1.0-draft',
    subject: 'Physical Science',
    gradeLevel: '8',
    sourceFiles: [
      {
        fileName: 'teacher_force_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high',
        notes: 'Teacher uploaded notes.'
      }
    ],
    vocabulary: [makeTeacherContentVocabularyItem('net-force', 'approved')],
    concepts: [makeTeacherContentConceptItem('balanced-forces', 'approved')],
    referenceFormulas: [makeTeacherContentReferenceFormula('force-reference', 'approved')],
    problemBank: [makeTeacherContentProblemItem('balanced-force-problem', 'approved')],
    standardsMap: [makeTeacherContentStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved')],
    smokeTests: [makeTeacherContentSmokeTest('approved')],
    metadata: {
      createdBy: 'test-suite',
      createdAt: '2026-05-14T00:00:00.000Z'
    },
    ...overrides
  };
}

function makeTeacherContentGeneratedPack(overrides = {}) {
  return makeTeacherContentPack({
    packId: 'prepared-review-draft',
    title: 'Prepared Review Draft',
    sourceFiles: [
      {
        fileName: 'teacher_prepare_review_notes.txt',
        fileType: 'txt',
        reviewStatus: 'approved',
        confidence: 'high',
        notes: 'Model output is normalized back to pending.'
      }
    ],
    vocabulary: [makeTeacherContentVocabularyItem('net-force', 'approved')],
    concepts: [makeTeacherContentConceptItem('balanced-forces', 'approved')],
    referenceFormulas: [
      {
        ...makeTeacherContentReferenceFormula('force-reference', 'approved'),
        solverStatus: 'ready'
      }
    ],
    problemBank: [makeTeacherContentProblemItem('balanced-force-problem', 'approved')],
    standardsMap: [makeTeacherContentStandardsMapItem('SAMPLE.PS.FORCES.1', 'approved')],
    smokeTests: [makeTeacherContentSmokeTest('approved')],
    ...overrides
  });
}

function makeTeacherContentVocabularyItem(term, reviewStatus) {
  return {
    term,
    aliases: [],
    studentDefinition: 'Net force is the total force on an object.',
    teacherDefinition: 'Net force is the vector sum of forces acting on an object.',
    misconception: 'Students may think balanced forces always mean no forces exist.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force is the total force on an object.'
  };
}

function makeTeacherContentConceptItem(conceptId, reviewStatus) {
  return {
    conceptId,
    title: 'Balanced Forces',
    aliases: [],
    studentExplanation: 'Balanced forces do not change motion.',
    keyIdeas: ['Balanced forces do not change motion.'],
    examples: ['Equal pushes from opposite sides.'],
    nonExamples: ['A stronger push from one side.'],
    commonMisconceptions: ['Balanced forces mean no forces exist.'],
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeTeacherContentReferenceFormula(formulaId, reviewStatus) {
  return {
    formulaId,
    title: 'Net Force Reference',
    equation: 'net force = sum of forces',
    variables: [],
    solverStatus: 'reference_only',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Net force is the sum of forces.'
  };
}

function makeTeacherContentProblemItem(problemId, reviewStatus) {
  return {
    problemId,
    question: 'A box has equal forces from both sides. What happens to its motion?',
    expectedAnswer: 'The balanced forces do not change its motion.',
    standards: ['SAMPLE.PS.FORCES.1'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeTeacherContentStandardsMapItem(standardId, reviewStatus) {
  return {
    standardId,
    description: 'Describe how balanced and unbalanced forces affect motion.',
    relatedVocabulary: ['net-force'],
    relatedConcepts: ['balanced-forces'],
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Describe how balanced and unbalanced forces affect motion.'
  };
}

function makeTeacherContentSmokeTest(reviewStatus) {
  return {
    question: 'What do balanced forces do?',
    expectedAnswer: 'They do not change motion.',
    reviewStatus,
    confidence: reviewStatus === 'approved' ? 'high' : 'medium',
    sourceFile: 'teacher_force_notes.txt',
    sourceLocation: 'Full Text',
    sourceTextSnippet: 'Balanced forces do not change motion.'
  };
}

function makeStandardsBank(overrides = {}) {
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
    metadata: {},
    ...overrides
  };
}

function makeTeacherContentStandardsBank(overrides = {}) {
  return makeStandardsBank({
    standards: [
      {
        standardId: 'SAMPLE.PS.FORCES.1',
        code: 'PS.FORCES.1',
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
      }
    ],
    ...overrides
  });
}

function makeDraftGeneratedPack(overrides = {}) {
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
    vocabulary: [makeDraftVocabularyItem()],
    concepts: [makeDraftConceptItem()],
    referenceFormulas: [makeDraftReferenceFormula()],
    problemBank: [makeDraftProblemItem()],
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

function makeDraftVocabularyItem() {
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

function makeDraftConceptItem() {
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

function makeDraftReferenceFormula() {
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

function makeDraftProblemItem() {
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

function makeDefaultStandardsMetadata() {
  return {
    linkedStandardIds: [],
    suggestedStandardIds: [],
    alignmentStatus: 'not_aligned_yet',
    alignmentSource: 'none'
  };
}

module.exports = {
  makeDefaultStandardsMetadata,
  makeDraftConceptItem,
  makeDraftGeneratedPack,
  makeDraftProblemItem,
  makeDraftReferenceFormula,
  makeDraftVocabularyItem,
  makeStandardsBank,
  makeTeacherContentConceptItem,
  makeTeacherContentGeneratedPack,
  makeTeacherContentPack,
  makeTeacherContentProblemItem,
  makeTeacherContentReferenceFormula,
  makeTeacherContentSmokeTest,
  makeTeacherContentStandardsBank,
  makeTeacherContentStandardsMapItem,
  makeTeacherContentVocabularyItem
};
