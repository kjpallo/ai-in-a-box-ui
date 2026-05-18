function buildKnowledgePackPrompt(options = {}) {
  const extraction = options.extraction;
  const standardsBank = options.standardsBank || null;
  const batchInfo = options.batchInfo || null;

  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    throw new Error('extraction must be an extraction JSON object.');
  }

  const standards = Array.isArray(standardsBank && standardsBank.standards)
    ? standardsBank.standards
    : [];
  const packName = typeof options.packName === 'string' ? options.packName.trim() : '';
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
    '- Treat the source extraction JSON as the full boundary of what you know for this draft.',
    '- Do not invent facts.',
    '- Do not invent standards.',
    '- Do not add outside examples, outside definitions, outside standards, or outside problem details.',
    '- If unsure, mark the item as needing teacher review by using reviewStatus: "pending" and confidence: "low".',
    '- Every generated item must use reviewStatus: "pending".',
    '- Every generated vocabulary, concept, referenceFormula, and problemBank item must include sourceFile, sourceLocation, sourceTextSnippet, confidence, and reviewStatus.',
    '- sourceTextSnippet is the source snippet field; use a short quote or close paraphrase from the provided text only.',
    '- Only include vocabulary terms explicitly present in the provided source text.',
    '- Do not infer extra vocabulary terms from topic context.',
    '- Every vocabulary sourceTextSnippet must contain the term itself or very close wording from the source.',
    '- If source evidence is weak or uncertain, keep reviewStatus: "pending" and set confidence: "low".',
    '- Preserve page, section, and chunk references in sourceLocation whenever they are available.',
    '- Formulas may be included only as referenceFormulas.',
    '- Every referenceFormula must use solverStatus: "reference_only".',
    '- Uploaded/reference formulas are for teacher review only and must not claim or imply built-in solver support.',
    '- Do not create solver code.',
    '- Do not describe solver logic.',
    '- Do not create formulas outside referenceFormulas.',
    '- Teacher review is required before anything becomes approved.',
    '- Do not imply the draft is approved.',
    packName ? `- Use this teacher-provided knowledge content name as the draft title: ${packName}` : '',
    batchInfo ? `- This prompt covers batch ${batchInfo.batchIndex} of ${batchInfo.totalBatches}; draft every useful item supported by this batch and keep sourceLocation tied to its chunk/page labels.` : '',
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
    'Coverage expectations:',
    '- Extract all meaningful teacher-review knowledge supported by the provided text.',
    '- For multi-section or multi-chunk text, include useful items from each relevant chunk instead of stopping after the first few items.',
    '- Leave a section empty only when the provided text does not support that kind of item.',
    '- Prefer concise items, but do not collapse a long packet into only one or two items when more source-supported knowledge is present.',
    '',
    'Item extraction rules:',
    '- Vocabulary = a named term, unit, variable, abbreviation, or phrase explicitly defined in the source text.',
    '- A vocabulary item should explain the term itself. Use vocabulary when the source says a term/unit/variable "is", "are", "means", "refers to", "is defined as", or gives a glossary/key-term definition.',
    '- Concept = a larger idea, relationship, category, process, or explanation supported by the source text.',
    '- A concept item should explain the broader idea, relationships, examples, how/why it works, or how a term is used in context.',
    '- The same phrase may appear once in vocabulary and once in concepts when the source supports both roles.',
    '- Do not dedupe across vocabulary and concepts: the vocabulary item explains the term, while the concept item explains the broader idea or relationship.',
    '- Reference formula = equation-like text, formula line, symbolic relationship, or unit relationship from the source.',
    '- Extract formula-like lines into referenceFormulas even when they are embedded in prose.',
    '- Keep formula text exactly source-supported; if extraction damaged the formula, include it with confidence: "low" for teacher review instead of inventing a cleaner version.',
    '- Include variables only when the source gives the variable symbols and meanings.',
    '- Problem bank = a worked example, practice question, exercise, or check-for-understanding prompt with an answer or expected answer from the source.',
    '- Do not turn unanswered questions into problemBank items unless the source provides the answer.',
    '',
    'Vocabulary alias and duplicate rules:',
    '- Preserve abbreviations shown in parentheses as aliases, such as "Term Name (TN)" -> aliases includes "TN".',
    '- Preserve unit symbols shown in parentheses as aliases for source-supported unit terms, such as "joule (J)" -> aliases includes "J".',
    '- Treat simple singular/plural variants as the same vocabulary term when they clearly mean the same thing.',
    '- Merge singular/plural duplicate vocabulary items into one canonical term with aliases and source evidence from every duplicate.',
    '- Example duplicate pattern: "joule" and "joules" should become one vocabulary item with the alternate form in aliases.',
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
    batch: extraction.metadata && extraction.metadata.importBatch ? extraction.metadata.importBatch : undefined,
    sections: summarizeSections(extraction.sections),
    tables: summarizeTables(extraction.tables),
    text: limitText(extraction.text || '', 20000)
  };
}

function summarizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.slice(0, 24).map((section, index) => ({
    label: section.label || `Section ${index + 1}`,
    sourceLocation: section.sourceLocation || section.label || `Section ${index + 1}`,
    pageNumber: section.pageNumber,
    chunkIndex: section.chunkIndex,
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
