function buildKnowledgePackPrompt(options = {}) {
  const extraction = options.extraction;
  const standardsBank = options.standardsBank || null;

  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    throw new Error('extraction must be an extraction JSON object.');
  }

  const standards = Array.isArray(standardsBank && standardsBank.standards)
    ? standardsBank.standards
    : [];
  const standardsList = standards.map((standard) => ({
    standardId: standard.standardId,
    code: standard.code,
    title: standard.title,
    officialText: standard.officialText,
    studentFriendlyText: standard.studentFriendlyText,
    keywords: standard.keywords || []
  }));

  return [
    'You are creating a teacher-review draft knowledge_pack.json for Charlemagne / AI-in-a-Box.',
    'Return one JSON object only.',
    'Return valid JSON only.',
    'Do not use markdown.',
    'Do not wrap the JSON in triple backticks.',
    'Escape all quotation marks inside string values.',
    'Do not include comments or trailing commas.',
    '',
    'Non-negotiable rules:',
    '- Use only the provided extracted text.',
    '- Do not invent facts.',
    '- Do not invent standards.',
    '- If unsure, mark confidence: "low".',
    '- Every generated item must use reviewStatus: "pending".',
    '- Every generated item must include sourceFile, sourceLocation, and sourceTextSnippet when possible.',
    '- Formulas may be included only as referenceFormulas.',
    '- Every referenceFormula must use solverStatus: "reference_only".',
    '- Do not create solver code.',
    '- Do not create formulas outside referenceFormulas.',
    '- Teacher review is required before anything becomes approved.',
    '- Do not imply the draft is approved.',
    '',
    'Use this exact required top-level JSON structure:',
    JSON.stringify(makeRequiredTopLevelSkeleton(), null, 2),
    '',
    'Vocabulary items must use this minimal object shape:',
    JSON.stringify(makeMinimalVocabularyExample(), null, 2),
    '',
    'Concept items must use this minimal object shape:',
    JSON.stringify(makeMinimalConceptExample(), null, 2),
    '',
    'Reference formulas, problem bank items, standards map entries, and smoke tests are optional, but if included they must match the full knowledge_pack.json shape below:',
    JSON.stringify(makeKnowledgePackSkeleton({ hasStandardsBank: standardsList.length > 0 }), null, 2),
    '',
    'Keep the draft small:',
    '- up to 12 vocabulary items',
    '- up to 8 concepts',
    '- up to 5 reference formulas',
    '- up to 10 problemBank items',
    '- up to 10 standardsMap entries',
    '- up to 8 smokeTests',
    '',
    standardsList.length > 0
      ? [
          'Available standards bank:',
          JSON.stringify(standardsList, null, 2),
          '',
          'Standards rules:',
          '- You may only use standardIds from the available standards bank above.',
          '- If no listed standard is clearly supported by the extracted text, leave standards arrays and standardsMap empty.',
          '- For standardsMap.description, use the listed standard text rather than inventing a new standard.'
        ].join('\n')
      : [
          'Standards rules:',
          '- No standards bank was provided.',
          '- Prefer an empty standardsMap and empty standards arrays.',
          '- Do not invent standardIds.'
        ].join('\n'),
    '',
    'Source extraction JSON:',
    JSON.stringify(makePromptExtraction(extraction), null, 2)
  ].join('\n');
}

function makeRequiredTopLevelSkeleton() {
  return {
    packId: 'lowercase-safe-pack-id',
    title: 'Teacher Review Draft Title',
    version: '0.1.0-draft',
    subject: 'Subject from extracted text',
    gradeLevel: 'Grade level from extracted text or "unknown"',
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

function makeMinimalVocabularyExample() {
  return {
    term: 'term from extracted text',
    aliases: [],
    studentDefinition: 'student-facing definition supported by extracted text',
    teacherDefinition: 'teacher-facing definition supported by extracted text',
    misconception: '',
    exampleQuestion: '',
    exampleAnswer: '',
    standards: [],
    reviewStatus: 'pending',
    confidence: 'low',
    sourceFile: 'source file name',
    sourceLocation: 'section, page, or extracted text',
    sourceTextSnippet: 'short quote or paraphrase from extraction'
  };
}

function makeMinimalConceptExample() {
  return {
    conceptId: 'lowercase-safe-concept-id',
    title: 'Concept Title from extracted text',
    aliases: [],
    studentExplanation: 'student-facing explanation supported by extracted text',
    keyIdeas: [],
    examples: [],
    nonExamples: [],
    commonMisconceptions: [],
    standards: [],
    reviewStatus: 'pending',
    confidence: 'low',
    sourceFile: 'source file name',
    sourceLocation: 'section, page, or extracted text',
    sourceTextSnippet: 'short quote or paraphrase from extraction'
  };
}

function makeKnowledgePackSkeleton(options = {}) {
  const skeleton = {
    packId: 'lowercase-safe-pack-id',
    title: 'Teacher Review Draft Title',
    version: '0.1.0-draft',
    subject: 'Subject from extracted text',
    gradeLevel: 'Grade level from extracted text or "unknown"',
    sourceFiles: [
      {
        fileName: 'source file name',
        fileType: 'source file type',
        reviewStatus: 'pending',
        confidence: 'low',
        notes: 'Optional source note'
      }
    ],
    vocabulary: [
      {
        term: 'term',
        aliases: [],
        studentDefinition: 'student-facing definition supported by the text',
        teacherDefinition: 'teacher-facing definition supported by the text',
        misconception: '',
        exampleQuestion: '',
        exampleAnswer: '',
        standards: [],
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'source file name',
        sourceLocation: 'section or page if known',
        sourceTextSnippet: 'short quote or paraphrase from extraction'
      }
    ],
    concepts: [
      {
        conceptId: 'lowercase-safe-concept-id',
        title: 'Concept Title',
        aliases: [],
        studentExplanation: 'student-facing explanation supported by the text',
        keyIdeas: [],
        examples: [],
        nonExamples: [],
        commonMisconceptions: [],
        standards: [],
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'source file name',
        sourceLocation: 'section or page if known',
        sourceTextSnippet: 'short quote or paraphrase from extraction'
      }
    ],
    referenceFormulas: [
      {
        formulaId: 'lowercase-safe-formula-id',
        title: 'Formula Title',
        equation: 'formula exactly as reference text',
        variables: [],
        studentExplanation: 'what the formula means, without solver steps',
        solverStatus: 'reference_only',
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'source file name',
        sourceLocation: 'section or page if known',
        sourceTextSnippet: 'short quote or paraphrase from extraction'
      }
    ],
    problemBank: [
      {
        problemId: 'lowercase-safe-problem-id',
        question: 'question from or directly supported by the source',
        expectedAnswer: 'answer from or directly supported by the source',
        standards: [],
        reviewStatus: 'pending',
        confidence: 'low',
        sourceFile: 'source file name',
        sourceLocation: 'section or page if known',
        sourceTextSnippet: 'short quote or paraphrase from extraction'
      }
    ],
    standardsMap: [],
    smokeTests: [
      {
        question: 'teacher review smoke-test question',
        expectedAnswer: 'expected answer supported by the source',
        reviewStatus: 'pending',
        confidence: 'low'
      }
    ],
    metadata: {
      createdBy: 'local-ollama-draft-generator',
      createdAt: 'ISO timestamp',
      updatedAt: 'ISO timestamp',
      notes: 'Generated draft. Requires teacher review before promotion.'
    }
  };

  if (options.hasStandardsBank) {
    skeleton.standardsMap = [
      {
        standardId: 'ONLY_FROM_PROVIDED_STANDARDS_BANK',
        description: 'standard description from provided bank',
        relatedVocabulary: [],
        relatedConcepts: [],
        reviewStatus: 'pending',
        confidence: 'low'
      }
    ];
  }

  return skeleton;
}

function makePromptExtraction(extraction) {
  return {
    fileName: extraction.fileName,
    filePath: extraction.filePath,
    extension: extraction.extension,
    mimeGuess: extraction.mimeGuess,
    metadata: extraction.metadata,
    warnings: extraction.warnings || [],
    sections: summarizeSections(extraction.sections),
    tables: summarizeTables(extraction.tables),
    text: limitText(extraction.text || '', 20000)
  };
}

function summarizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.slice(0, 12).map((section, index) => ({
    label: section.label || `Section ${index + 1}`,
    text: limitText(section.text || '', 4000)
  }));
}

function summarizeTables(tables) {
  if (!Array.isArray(tables)) return [];
  return tables.slice(0, 6).map((table) => ({
    label: table.label,
    rows: Array.isArray(table.rows) ? table.rows.slice(0, 25) : []
  }));
}

function limitText(text, maxLength) {
  const value = String(text || '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n[truncated for prompt length]`;
}

module.exports = {
  buildKnowledgePackPrompt
};
