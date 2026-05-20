function buildKnowledgePackPrompt(options = {}) {
  const extraction = options.extraction;
  const batchInfo = options.batchInfo || null;
  const packName = typeof options.packName === 'string' ? options.packName.trim() : '';

  if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
    throw new Error('extraction must be an extraction JSON object.');
  }

  return [
    'You are creating a teacher-review draft import for Charlemagne / AI-in-a-Box.',
    'Return one JSON object only.',
    'Return valid JSON only.',
    'Do not use markdown or code fences.',
    'Do not include comments or trailing commas.',
    '',
    'Output only this top-level JSON shape:',
    JSON.stringify(makeCompactDraftShape(), null, 2),
    '',
    'Rules:',
    '- Use only the provided extracted text.',
    '- Do not invent facts, standards, smoke tests, problem bank items, or metadata.',
    '- Standards are paused. Do not generate standardsMap or standards IDs.',
    '- Extract only these sections: vocabulary, concepts, referenceFormulas, uncertainSections.',
    '- uncertainSections should be a short list of source areas that likely need teacher follow-up.',
    '- Every vocabulary/concept/referenceFormula item must include: sourceFile, sourceLocation, sourceTextSnippet, confidence, reviewStatus.',
    '- Keep reviewStatus as "pending" for all generated items.',
    '- If uncertain, use confidence "low" and add the location to uncertainSections.',
    '- Preserve page/chunk labels in sourceLocation when available.',
    '- Formulas must stay in referenceFormulas only.',
    '- Every referenceFormula must use solverStatus: "reference_only".',
    '- Do not create or describe formula solver code.',
    '- Only include vocabulary terms explicitly present in the source text.',
    '- The same phrase may appear in both vocabulary and concepts when source evidence supports both roles.',
    packName ? `- Teacher-provided content name: ${packName}` : '',
    batchInfo
      ? `- This prompt covers batch ${batchInfo.batchIndex} of ${batchInfo.totalBatches}; keep each item grounded to this batch's source labels.`
      : '',
    '',
    'Source extraction JSON:',
    JSON.stringify(makePromptExtraction(extraction), null, 2)
  ].filter(Boolean).join('\n');
}

function makeCompactDraftShape() {
  return {
    vocabulary: [makeMinimalVocabularyExample()],
    concepts: [makeMinimalConceptExample()],
    referenceFormulas: [makeMinimalReferenceFormulaExample()],
    uncertainSections: [
      {
        sourceLocation: 'Page 2 / Chunk 1',
        note: 'Short reason this area may need teacher review.'
      }
    ]
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
    reviewStatus: 'pending',
    confidence: 'low',
    sourceFile: 'source file name',
    sourceLocation: 'section, page, or chunk label',
    sourceTextSnippet: 'short quote or close paraphrase from extracted text'
  };
}

function makeMinimalConceptExample() {
  return {
    conceptId: 'lowercase-safe-concept-id',
    title: 'Concept title from extracted text',
    aliases: [],
    studentExplanation: 'student-facing explanation supported by extracted text',
    keyIdeas: [],
    examples: [],
    nonExamples: [],
    commonMisconceptions: [],
    reviewStatus: 'pending',
    confidence: 'low',
    sourceFile: 'source file name',
    sourceLocation: 'section, page, or chunk label',
    sourceTextSnippet: 'short quote or close paraphrase from extracted text'
  };
}

function makeMinimalReferenceFormulaExample() {
  return {
    formulaId: 'lowercase-safe-formula-id',
    title: 'Formula title from extracted text',
    equation: 'equation text from source',
    variables: [],
    studentExplanation: 'brief meaning from extracted text',
    solverStatus: 'reference_only',
    reviewStatus: 'pending',
    confidence: 'low',
    sourceFile: 'source file name',
    sourceLocation: 'section, page, or chunk label',
    sourceTextSnippet: 'short quote or close paraphrase from extracted text'
  };
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
    text: limitText(extraction.text || '', 8000)
  };
}

function summarizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  return sections.slice(0, 16).map((section, index) => ({
    label: section.label || `Section ${index + 1}`,
    sourceLocation: section.sourceLocation || section.label || `Section ${index + 1}`,
    pageNumber: section.pageNumber,
    chunkIndex: section.chunkIndex,
    text: limitText(section.text || '', 1500)
  }));
}

function summarizeTables(tables) {
  if (!Array.isArray(tables)) return [];
  return tables.slice(0, 3).map((table) => ({
    label: table.label,
    rows: Array.isArray(table.rows) ? table.rows.slice(0, 10) : []
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
