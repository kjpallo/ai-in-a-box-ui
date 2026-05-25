function buildKnowledgePackPrompt(options = {}) {
  const extraction = options.extraction;
  const batchInfo = options.batchInfo || null;
  const packName = typeof options.packName === 'string' ? options.packName.trim() : '';
  const importProfile = normalizeImportProfile(options.importProfile);

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
    '- Never set reviewStatus to approved or rejected.',
    '- If uncertain, use confidence "low" and add the location to uncertainSections.',
    '- Preserve page/chunk labels in sourceLocation when available.',
    '- Formulas must stay in referenceFormulas only.',
    '- Every referenceFormula must use solverStatus: "reference_only".',
    '- Do not create or describe formula solver code.',
    '- Extract concept items when source headings include Core Concept, Concept Check, Key Idea, Important Idea, Main Idea, Useful Concepts, Review Items, Misconception/Common Mistake, Cause and Effect, Timeline, People/Events/Dates, or Procedure/Steps.',
    '- People/events/dates/cause-effect content should become reviewable concepts when source support is clear.',
    '- Procedure or sequence steps should become concepts when they explain a meaningful teaching point.',
    '- Concepts must include both title and studentExplanation grounded in nearby source text.',
    '- Concept titles must be short noun-phrase titles, not full sentence fragments.',
    '- If a line starts with learning-target wording (for example "Students should explain..."), convert it into a clean concept title only when source support is clear; otherwise skip it.',
    '- Do not leave "Students should explain..." wording as concept studentExplanation; rewrite to factual concept wording from nearby source text or omit the concept.',
    '- Only include vocabulary terms explicitly present in the source text.',
    '- Prefer vocabulary terms listed in glossary/vocabulary sections over sentence fragments.',
    '- When source text has a "Term: definition" line, use only the definition after the colon for studentDefinition/teacherDefinition.',
    '- Do not copy whole slide/chunk text into a definition when a clean "Term: definition" line exists.',
    '- Never output section labels or junk fragments as vocabulary terms, including: Core Concept, Concept Check, Key Idea, Important Idea, Main Idea, Useful Vocabulary, Useful Concepts, Review Items, Vocabulary, Reference Formula, Formula, Example, Review, Practice, use, se alignment.',
    '- Every vocabulary item must include both studentDefinition and teacherDefinition, or omit the item.',
    '- Do not output vocabulary fragments, units, number-only tokens, or equation pieces.',
    '- Do not output worked examples as reference formulas.',
    '- Do not output code snippets or programming examples as reference formulas.',
    '- Keep reference formulas to clean symbolic relationships (for example: V = I × R, I = V/R, R = V/I).',
    '- Every concept must include studentExplanation, or omit the item.',
    '- Every reference formula must include equation text, or omit the item.',
    '- The same phrase may appear in both vocabulary and concepts when source evidence supports both roles.',
    importProfile === 'physical_science' ? '- Physical science import profile is active.' : '',
    importProfile === 'physical_science' ? '- Focus on science vocabulary terms with usable definitions.' : '',
    importProfile === 'physical_science' ? '- Extract physical science relationships from normal teacher wording: motion, forces, energy, waves, electricity, magnetism, thermal energy, density, buoyancy.' : '',
    importProfile === 'physical_science' ? '- Extract formulas only when an equation or clear symbolic relationship appears in the source text.' : '',
    importProfile === 'physical_science' ? '- Keep every extracted formula in referenceFormulas with solverStatus: "reference_only".' : '',
    importProfile === 'physical_science' ? '- Include variables and units only when visible in source text.' : '',
    importProfile === 'physical_science' ? '- Extract concepts from cause/effect, compare/contrast, graph interpretation, misconception, lab/procedure, and "what changes when..." statements when source support is clear.' : '',
    importProfile === 'physical_science' ? '- Do not turn slide titles, section labels, or teacher directions into concept items.' : '',
    importProfile === 'physical_science' ? '- Do not output weak sentence-fragment concept titles.' : '',
    importProfile === 'physical_science' ? '- If source evidence is thin, keep confidence low and add uncertainSections entries.' : '',
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

function normalizeImportProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'physical_science') return 'physical_science';
  return 'general';
}
