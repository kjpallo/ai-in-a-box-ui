const path = require('node:path');

const { SAFE_PACK_ID_PATTERN } = require('../knowledge/packSchema');
const { makeDefaultStandardsMetadata } = require('../knowledge/standardsMetadata');
const {
  DEFAULT_SCHEMA_VERSION,
  DEFAULT_DRAFT_VERSION,
  GENERATED_ITEM_SECTIONS,
  REJECTED_VOCAB_LABEL_KEYS,
  FORMULA_LABEL_PATTERN,
  VOCAB_SECTION_LABEL_PATTERN,
  CONCEPT_LABEL_PATTERN,
  FORMULA_VARIABLE_VOCAB_KEYS
} = require('./importConstants');
const { firstNonEmptyString, nonEmptyString, sanitizePackName } = require('./importTextUtils');
const {
  contentTokens,
  findMatchingExtractionSections,
  isPageHeaderText,
  looksHeadingOnlyEvidence,
  looksSlideHeaderLine,
  makeItemEvidenceText,
  meaningfulOverlap,
  phraseAppearsInText
} = require('./sourceEvidenceValidation');

function mergeDraftKnowledgePacks(packs, options = {}) {
  const base = normalizeDraftKnowledgePack({ ...(packs[0] || {}) }, options);
  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    base[sectionName] = [];
  });

  base.sourceFiles = mergeUniqueObjects(packs.flatMap((pack) => pack.sourceFiles || []), sourceFileKey);
  const vocabularyRaw = packs.flatMap((pack) => pack.vocabulary || []);
  const conceptsRaw = packs.flatMap((pack) => pack.concepts || []);
  const problemsRaw = packs.flatMap((pack) => pack.problemBank || []);
  base.vocabulary = mergeVocabularyItems(vocabularyRaw);
  base.concepts = mergeConceptItems(conceptsRaw);
  base.referenceFormulas = mergeUniqueObjects(packs.flatMap((pack) => pack.referenceFormulas || []), formulaKey);
  base.problemBank = mergeUniqueObjects(problemsRaw, problemKey);
  base.standardsMap = mergeUniqueObjects(packs.flatMap((pack) => pack.standardsMap || []), standardsMapKey);
  base.smokeTests = mergeUniqueObjects(packs.flatMap((pack) => pack.smokeTests || []), smokeTestKey);
  base.metadata = {
    ...(base.metadata || {}),
    importBatches: packs.length,
    importScope: options.importScope || base.metadata && base.metadata.importScope,
    invalidGeneratedItems: mergeInvalidGeneratedItems(
      packs.flatMap((pack) => (Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
        ? pack.metadata.invalidGeneratedItems
        : [])),
      base.metadata && base.metadata.invalidGeneratedItems
    ),
    importWarnings: mergeImportWarnings(
      packs.flatMap((pack) => (Array.isArray(pack && pack.metadata && pack.metadata.importWarnings)
        ? pack.metadata.importWarnings
        : [])),
      base.metadata && base.metadata.importWarnings
    ),
    deduplication: {
      vocabulary: makeDeduplicationStats(vocabularyRaw.length, base.vocabulary.length),
      concepts: makeDeduplicationStats(conceptsRaw.length, base.concepts.length),
      problemBank: makeDeduplicationStats(problemsRaw.length, base.problemBank.length)
    }
  };

  const packName = sanitizePackName(options.packName);
  if (packName) base.title = packName;
  return base;
}

function makeDeduplicationStats(raw, final) {
  return {
    raw,
    duplicatesRemoved: Math.max(0, raw - final),
    final
  };
}

function mergeUniqueObjects(items, makeKey) {
  const seen = new Map();
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const key = makeKey(item);
    if (key && seen.has(key)) {
      mergeSourceEvidence(merged[seen.get(key)], item);
      return;
    }
    if (key) seen.set(key, merged.length);
    merged.push(item);
  });
  return merged;
}

function mergeConceptItems(items) {
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const existingIndex = merged.findIndex((existing) => areDuplicateConceptItems(existing, item));
    if (existingIndex >= 0) {
      mergeConceptDuplicate(merged[existingIndex], item);
      return;
    }
    merged.push(item);
  });
  return merged;
}

function mergeVocabularyItems(items) {
  const seen = new Map();
  const merged = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const keys = vocabularyKeys(item);
    const existingIndex = keys.map((key) => seen.get(key)).find((index) => Number.isInteger(index));
    if (Number.isInteger(existingIndex)) {
      mergeVocabularyDuplicate(merged[existingIndex], item);
      vocabularyKeys(merged[existingIndex]).forEach((key) => seen.set(key, existingIndex));
      return;
    }
    const nextIndex = merged.length;
    keys.forEach((key) => seen.set(key, nextIndex));
    merged.push(item);
  });
  return merged;
}

function sourceFileKey(item) {
  return normalizeKey(item.fileName);
}

function vocabularyKey(item) {
  return canonicalVocabularyKey(item.term);
}

function conceptKey(item) {
  return normalizeItemKey(firstNonEmptyString(item.title, item.claim, item.conceptId));
}

function conceptExplanationKey(item) {
  const explanation = firstNonEmptyString(
    item && item.studentExplanation,
    item && item.teacherExplanation,
    Array.isArray(item && item.keyIdeas) ? item.keyIdeas.join(' ') : ''
  );
  const tokens = contentTokens(stripLikelyTruncatedTail(explanation));
  return tokens.length >= 4 ? tokens.slice(0, 8).join(' ') : '';
}

function areDuplicateConceptItems(a, b) {
  const exactA = conceptKey(a);
  const exactB = conceptKey(b);
  if (exactA && exactB && exactA === exactB) return true;
  if (looksSyntheticPageOrChunkConcept(a) || looksSyntheticPageOrChunkConcept(b)) return false;
  const explanationA = conceptExplanationKey(a);
  const explanationB = conceptExplanationKey(b);
  if (!explanationA || !explanationB || explanationA !== explanationB) return false;
  const sameSource = normalizeItemKey(a && a.sourceLocation) === normalizeItemKey(b && b.sourceLocation);
  const titleOverlap = meaningfulOverlap(firstNonEmptyString(a && a.title), firstNonEmptyString(b && b.title), []);
  const titleRelated = titleOverlap.count >= 1 || meaningfulOverlap(firstNonEmptyString(b && b.title), firstNonEmptyString(a && a.title), []).count >= 1;
  return sameSource || titleRelated;
}

function looksSyntheticPageOrChunkConcept(item) {
  const title = normalizeItemKey(firstNonEmptyString(item && item.title));
  return /^(?:page|chunk) \d+ concept$/u.test(title);
}

function formulaKey(item) {
  return normalizeFormulaEquation(item && item.equation) || normalizeKey(firstNonEmptyString(item.formulaId, item.title));
}

function problemKey(item) {
  return normalizeItemKey(firstNonEmptyString(item.question, item.problemId));
}

function standardsMapKey(item) {
  return normalizeKey(item.standardId);
}

function smokeTestKey(item) {
  return normalizeKey(item.question);
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeItemKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalVocabularyKey(value) {
  const normalized = normalizeItemKey(stripParentheticalAlias(String(value || '')));
  if (!normalized) return '';
  const parts = normalized.split(' ');
  parts[parts.length - 1] = singularizeSimpleWord(parts[parts.length - 1]);
  return parts.join(' ');
}

function vocabularyKeys(item) {
  const values = [
    item && item.term,
    ...(Array.isArray(item && item.aliases) ? item.aliases : [])
  ];
  return Array.from(new Set(values.map(canonicalVocabularyKey).filter(Boolean)));
}

function singularizeSimpleWord(word) {
  const value = String(word || '').trim();
  if (value.length <= 3) return value;
  if (/ies$/i.test(value) && value.length > 4) return `${value.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/i.test(value) && value.length > 5) return value.slice(0, -2);
  if (/s$/i.test(value) && !/(ss|us|is)$/i.test(value)) return value.slice(0, -1);
  return value;
}

function normalizeDraftKnowledgePack(pack, options = {}) {
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return pack;

  const normalized = normalizeCompactModelOutput(pack);
  const unsupportedTopLevelArrays = collectUnsupportedTopLevelModelArrays(pack);
  const sourceDefaults = makeSourceDefaults(options.extraction);
  const importProfile = normalizeImportProfile(options.importProfile || sourceDefaults.importProfile);
  const packName = sanitizePackName(options.packName);
  const safePackId = makeDraftPackId({
    packName,
    extraction: options.extraction,
    fallbackPackId: normalized.packId
  });

  normalized.schemaVersion = DEFAULT_SCHEMA_VERSION;
  normalized.packId = safePackId;
  if (typeof normalized.version !== 'string' || normalized.version.trim().length === 0) {
    normalized.version = DEFAULT_DRAFT_VERSION;
  }

  if (packName) {
    normalized.title = packName;
  }
  if (!nonEmptyString(normalized.title)) normalized.title = titleFromPackId(safePackId);
  normalized.subject = sourceDefaults.subject || (importProfile === 'physical_science' ? 'Physical Science' : 'Teacher Uploaded Content');
  normalized.gradeLevel = sanitizeModelString(normalized.gradeLevel) || sourceDefaults.gradeLevel || 'Teacher Review';
  normalized.status = 'draft';
  normalized.reviewStatus = 'pending';

  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    if (!Array.isArray(normalized[sectionName])) {
      normalized[sectionName] = [];
    }
  });

  if (!normalized.metadata || typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
    normalized.metadata = {};
  }
  normalized.metadata = buildSafeDraftMetadata(normalized.metadata, {
    extraction: options.extraction,
    packName,
    packId: safePackId,
    sourceDefaults,
    importProfile,
    importScope: options.importScope
  });
  if (unsupportedTopLevelArrays.length > 0) {
    normalized.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(
      normalized.metadata.invalidGeneratedItems,
      unsupportedTopLevelArrays
    );
  }

  normalized.sourceFiles = normalizeSourceFiles(normalized.sourceFiles, options.extraction, sourceDefaults);
  normalized.vocabulary = normalized.vocabulary.map((item, index) => normalizeVocabularyItem(item, sourceDefaults, index));
  normalized.concepts = normalized.concepts.map((item, index) => normalizeConceptItem(item, sourceDefaults, index));
  normalized.referenceFormulas = normalized.referenceFormulas.map((item, index) => normalizeReferenceFormula(item, sourceDefaults, index));
  addSourceDerivedVocabulary(normalized, options.extraction, sourceDefaults);
  addSourceDerivedConcepts(normalized, options.extraction, sourceDefaults);
  addSourceDerivedReferenceFormulas(normalized, options.extraction, sourceDefaults);
  recoverConceptExplanationsFromSource(normalized, options.extraction);
  recoverVocabularyDefinitionsFromSource(normalized, options.extraction);
  cleanupConceptTitles(normalized, options.extraction, importProfile);
  applyVocabularyQualityGates(normalized, options.extraction, importProfile);
  applyFormulaQualityGates(normalized, options.extraction, importProfile);
  normalized.problemBank = normalized.problemBank.map((item, index) => normalizeProblemItem(item, sourceDefaults, index));
  normalized.standardsMap = normalized.standardsMap.map((item, index) => normalizeStandardsMapItem(item, index));
  normalized.smokeTests = normalized.smokeTests.map((item, index) => normalizeSmokeTest(item, index));
  const salvageReport = salvageGeneratedItemSections(normalized, options.extraction);
  if (salvageReport.invalidItems.length > 0) {
    normalized.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(
      normalized.metadata.invalidGeneratedItems,
      salvageReport.invalidItems
    );
    normalized.metadata.importWarnings = mergeImportWarnings(
      normalized.metadata.importWarnings,
      salvageReport.importWarnings
    );
  }
  normalized.metadata.deduplication = dedupeDraftItems(normalized);
  normalized.metadata.importNormalization = buildImportNormalizationReport(normalized);

  return normalized;
}

function normalizeCompactModelOutput(pack = {}) {
  const normalized = { ...(pack || {}) };
  delete normalized.results;
  normalized.vocabulary = Array.isArray(normalized.vocabulary) ? normalized.vocabulary : [];
  normalized.concepts = Array.isArray(normalized.concepts) ? normalized.concepts : [];
  normalized.referenceFormulas = Array.isArray(normalized.referenceFormulas) ? normalized.referenceFormulas : [];
  normalized.problemBank = Array.isArray(normalized.problemBank) ? normalized.problemBank : [];
  normalized.standardsMap = Array.isArray(normalized.standardsMap) ? normalized.standardsMap : [];
  normalized.smokeTests = Array.isArray(normalized.smokeTests) ? normalized.smokeTests : [];
  normalized.sourceFiles = Array.isArray(normalized.sourceFiles) ? normalized.sourceFiles : [];

  const uncertainSections = Array.isArray(pack && pack.uncertainSections)
    ? pack.uncertainSections
      .map((entry) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          return {
            sourceLocation: String(entry.sourceLocation || entry.location || '').trim(),
            note: String(entry.note || entry.reason || '').trim()
          };
        }
        const text = String(entry || '').trim();
        return text ? { sourceLocation: '', note: text } : null;
      })
      .filter((entry) => entry && (entry.sourceLocation || entry.note))
    : [];

  if (!normalized.metadata || typeof normalized.metadata !== 'object' || Array.isArray(normalized.metadata)) {
    normalized.metadata = {};
  }
  if (uncertainSections.length > 0) {
    normalized.metadata.importUncertainSections = uncertainSections;
  }

  delete normalized.uncertainSections;
  return normalized;
}

function collectUnsupportedTopLevelModelArrays(pack = {}) {
  const unsupported = [];
  if (Array.isArray(pack.results) && pack.results.length > 0) {
    unsupported.push({
      section: 'results',
      index: 0,
      reason: 'Ignored unsupported top-level model output array: results.',
      originalItem: {
        count: pack.results.length
      }
    });
  }
  return unsupported;
}

function normalizeSourceFiles(sourceFiles, extraction, sourceDefaults) {
  const normalized = sourceFiles.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return normalizeReviewFields({
      ...item,
      uploadId: sourceDefaults.uploadId,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount,
      fileType: typeof item.fileType === 'string' && item.fileType.trim()
        ? item.fileType
        : sourceDefaults.fileType
    });
  });

  if (sourceDefaults.sourceFile && !normalized.some((item) => {
    return item && typeof item === 'object' && !Array.isArray(item) && item.fileName === sourceDefaults.sourceFile;
  })) {
    normalized.push({
      fileName: sourceDefaults.sourceFile,
      fileType: sourceDefaults.fileType,
      uploadId: sourceDefaults.uploadId,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount,
      reviewStatus: 'pending',
      confidence: 'low',
      notes: 'Added from extraction metadata for draft traceability.'
    });
  }

  return normalized;
}

function normalizeVocabularyItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  const aliasResult = normalizeTermAliases({
    label: normalized.term,
    aliases: [normalized.alias, normalized.aliases, normalized.synonym, normalized.synonyms],
    sourceTextSnippet: normalized.sourceTextSnippet || normalized.sourceSnippet
  });
  if (aliasResult.label) normalized.term = aliasResult.label;
  normalized.aliases = aliasResult.aliases;
  if (!nonEmptyString(normalized.term)) {
    const derivedTerm = deriveShortTitle([
      normalized.synonym,
      normalized.synonyms,
      normalized.alias,
      normalized.aliases,
      normalized.word,
      normalized.title,
      normalized.label,
      normalized.name,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (derivedTerm) {
      normalized.term = derivedTerm;
      normalized = addNormalizationNote(normalized, 'Generated vocabulary term during import normalization from model/source text.');
    }
  }
  if (!nonEmptyString(normalized.vocabId) && nonEmptyString(normalized.term)) {
    normalized.vocabId = makeGeneratedItemId('vocab', [normalized.term], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated vocabulary ID during import normalization.');
  }
  return normalizeSourceTracking(normalizeReviewFields({
    ...normalized,
    aliases: normalizeAliasList(normalized.aliases, normalized.term),
    standards: makeDefaultStandardsMetadata()
  }), sourceDefaults);
}

function normalizeConceptItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  const aliasResult = normalizeTermAliases({
    label: normalized.title,
    aliases: [normalized.alias, normalized.aliases],
    sourceTextSnippet: normalized.sourceTextSnippet || normalized.sourceSnippet
  });
  if (aliasResult.label) normalized.title = aliasResult.label;
  normalized.aliases = aliasResult.aliases;
  if (!nonEmptyString(normalized.title)) {
    const derivedTitle = deriveShortTitle([
      normalized.title,
      normalized.concept,
      normalized.claim,
      normalized.summary,
      normalized.explanation,
      normalized.studentExplanation,
      toDisplayLabelFromId(normalized.conceptId),
      normalized.label,
      normalized.name,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (derivedTitle) {
      normalized.title = derivedTitle;
      normalized = addNormalizationNote(normalized, 'Generated concept title during import normalization from model/source text.');
    }
  }
  if (!nonEmptyString(normalized.conceptId)) {
    normalized.conceptId = makeGeneratedItemId('concept', [
      normalized.title,
      normalized.concept,
      normalized.claim,
      normalized.summary,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated concept ID during import normalization.');
  }
  ['aliases', 'keyIdeas', 'examples', 'nonExamples', 'commonMisconceptions'].forEach((field) => {
    if (!Array.isArray(normalized[field])) normalized[field] = [];
  });
  normalized.standards = makeDefaultStandardsMetadata();
  return normalizeSourceTracking(normalizeReviewFields(normalized), sourceDefaults);
}

function normalizeReferenceFormula(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = normalizeSourceTracking(normalizeReviewFields({
    ...item,
    variables: Array.isArray(item.variables) ? item.variables : [],
    standards: makeDefaultStandardsMetadata(),
    solverStatus: 'reference_only'
  }), sourceDefaults);
  if (!nonEmptyString(normalized.equation)) {
    const recoveredEquation = deriveEquationText(normalized);
    if (recoveredEquation) {
      normalized.equation = recoveredEquation;
      normalized = addNormalizationNote(normalized, 'Recovered formula equation during import normalization.');
    }
  }
  if (!nonEmptyString(normalized.title) && nonEmptyString(normalized.equation)) {
    normalized.title = makeFormulaTitle(normalized.equation, index);
    normalized = addNormalizationNote(normalized, 'Generated formula title during import normalization.');
  } else if (!nonEmptyString(normalized.title)) {
    const recoveredTitle = deriveShortTitle([
      normalized.title,
      normalized.label,
      normalized.name,
      normalized.formulaName,
      toDisplayLabelFromId(normalized.formulaId),
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ]);
    if (recoveredTitle) {
      normalized.title = recoveredTitle;
      normalized = addNormalizationNote(normalized, 'Recovered formula title during import normalization.');
    }
  }
  if (!nonEmptyString(normalized.formulaId)) {
    normalized.formulaId = makeGeneratedItemId('formula', [
      normalized.title,
      normalized.equation,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated formula ID during import normalization.');
  }
  const repairedEquation = repairReferenceEquation(
    normalized.equation,
    [
      normalized.sourceTextSnippet,
      normalized.studentExplanation,
      normalized.notes,
      normalized.title
    ].filter(nonEmptyString).join(' ')
  );
  if (repairedEquation.changed) {
    normalized.equation = repairedEquation.equation;
    normalized = addNormalizationNote(normalized, repairedEquation.note || 'Repaired extracted formula text during import normalization.');
  }
  if (!nonEmptyString(normalized.title) || /reference formula$/iu.test(String(normalized.title || '').trim())) {
    normalized.title = makeFormulaTitle(normalized.equation, index);
  }
  if (looksExtractionDamagedFormula(normalized.equation)) {
    return addNormalizationNote(normalized, 'Formula text may be extraction-damaged; keep pending teacher review.');
  }
  return normalized;
}

function salvageGeneratedItemSections(pack, extraction) {
  const invalidItems = [];
  const importWarnings = [];
  const pushInvalid = (entry) => {
    invalidItems.push(entry);
    importWarnings.push(formatInvalidGeneratedItemWarning(entry));
  };

  const vocabulary = Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : [];
  pack.vocabulary = vocabulary.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'term'
      });
      return false;
    }
    if (nonEmptyString(item.term)) return true;
    const recoveredTerm = deriveShortTitle([
      item.title,
      item.label,
      item.name,
      item.word,
      item.synonym,
      item.synonyms,
      item.alias,
      item.aliases
    ]);
    if (recoveredTerm) {
      item.term = recoveredTerm;
      Object.assign(item, addNormalizationNote(item, 'Recovered vocabulary term during item-level salvage.'));
    }
    if (!nonEmptyString(item.term)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: 'Missing required term and no usable title/label/name was available.',
        requiredField: 'term'
      });
      return false;
    }
    if (isVocabularySectionLabel(item.term)) {
      pushInvalid({
        section: 'vocabulary',
        index,
        reason: `Vocabulary term "${item.term}" matched a section label and was removed.`,
        requiredField: 'term'
      });
      return false;
    }
    if (!hasQuarantineMarker(item) && (isMissingDraftWordingValue(item.studentDefinition) || isMissingDraftWordingValue(item.teacherDefinition))) {
      const evidence = makeItemEvidenceText(item, extraction);
      const recoveredDefinition = recoverVocabularyDefinitionText(item, evidence, extraction);
      if (recoveredDefinition) {
        if (isMissingDraftWordingValue(item.studentDefinition)) item.studentDefinition = recoveredDefinition;
        if (isMissingDraftWordingValue(item.teacherDefinition)) item.teacherDefinition = recoveredDefinition;
        Object.assign(item, addNormalizationNote(item, 'Recovered vocabulary definition wording during item-level salvage.'));
      }
    }
    if (hasQuarantineMarker(item) || (!isMissingDraftWordingValue(item.studentDefinition) && !isMissingDraftWordingValue(item.teacherDefinition))) return true;
    pushInvalid({
      section: 'vocabulary',
      index,
      reason: 'Missing required studentDefinition/teacherDefinition and recovery failed.',
      requiredField: 'studentDefinition/teacherDefinition'
    });
    return false;
  });

  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  pack.concepts = concepts.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'concepts',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title'
      });
      return false;
    }
    if (nonEmptyString(item.title)) {
      const cleanedTitle = normalizeConceptHeading(item.title);
      if (cleanedTitle && cleanedTitle !== item.title) {
        item.title = cleanedTitle;
        Object.assign(item, addNormalizationNote(item, 'Normalized concept title wording during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title)) {
      const recoveredTitle = deriveShortTitle([
        item.title,
        item.label,
        item.name,
        item.concept,
        item.claim,
        item.summary,
        item.explanation,
        item.studentExplanation,
        conceptIdTitleCandidate(item.conceptId)
      ]);
      if (recoveredTitle) {
        item.title = normalizeConceptHeading(recoveredTitle);
        Object.assign(item, addNormalizationNote(item, 'Recovered concept title during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title)) {
      pushInvalid({
        section: 'concepts',
        index,
        reason: 'Missing required title and no usable concept wording was available.',
        requiredField: 'title'
      });
      return false;
    }
    const needsExplanationRecovery = isMissingDraftWordingValue(item.studentExplanation) || isLearningTargetSentence(item.studentExplanation);
    if (!hasQuarantineMarker(item) && needsExplanationRecovery) {
      const evidence = makeItemEvidenceText(item, extraction);
      const recovered = recoverConceptExplanationText(item, evidence);
      if (recovered) {
        item.studentExplanation = recovered;
        Object.assign(item, addNormalizationNote(item, 'Recovered concept explanation wording during item-level salvage.'));
      }
    }
    if (hasQuarantineMarker(item) || (!isMissingDraftWordingValue(item.studentExplanation) && !isLearningTargetSentence(item.studentExplanation))) return true;
    pushInvalid({
      section: 'concepts',
      index,
      reason: 'Missing usable studentExplanation and recovery failed.',
      requiredField: 'studentExplanation'
    });
    return false;
  });

  const formulas = Array.isArray(pack && pack.referenceFormulas) ? pack.referenceFormulas : [];
  pack.referenceFormulas = formulas.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      pushInvalid({
        section: 'referenceFormulas',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title/equation'
      });
      return false;
    }
    if (!nonEmptyString(item.equation)) {
      const recoveredEquation = deriveEquationText(item);
      if (recoveredEquation) {
        item.equation = recoveredEquation;
        Object.assign(item, addNormalizationNote(item, 'Recovered formula equation during item-level salvage.'));
      }
    }
    if (!nonEmptyString(item.title) && nonEmptyString(item.equation)) {
      item.title = makeFormulaTitle(item.equation, index);
      Object.assign(item, addNormalizationNote(item, 'Recovered formula title during item-level salvage.'));
    }
    if (!nonEmptyString(item.title)) {
      const recoveredTitle = deriveShortTitle([
        item.title,
        item.label,
        item.name,
        item.formulaName,
        toDisplayLabelFromId(item.formulaId),
        item.sourceTextSnippet,
        item.sourceSnippet
      ]);
      if (recoveredTitle) {
        item.title = recoveredTitle;
        Object.assign(item, addNormalizationNote(item, 'Recovered formula title during item-level salvage.'));
      }
    }
    if (nonEmptyString(item.title) && nonEmptyString(item.equation)) return true;
    pushInvalid({
      section: 'referenceFormulas',
      index,
      reason: 'Missing required title/equation and recovery failed.',
      requiredField: 'title/equation'
    });
    return false;
  });

  return {
    invalidItems,
    importWarnings
  };
}

function normalizeProblemItem(item, sourceDefaults, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.problemId) && nonEmptyString(normalized.question)) {
    normalized.problemId = makeGeneratedItemId('problem', [
      normalized.question,
      normalized.sourceTextSnippet,
      normalized.sourceSnippet
    ], index, sourceDefaults);
    normalized = addNormalizationNote(normalized, 'Generated problem ID during import normalization.');
  }
  return normalizeSourceTracking(normalizeReviewFields({
    ...normalized,
    standards: makeDefaultStandardsMetadata()
  }), sourceDefaults);
}

function normalizeStandardsMapItem(item, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.standardId)) {
    const standardId = firstNonEmptyString(normalized.standard, normalized.standardCode, normalized.id);
    if (standardId) {
      normalized.standardId = standardId;
      normalized = addNormalizationNote(normalized, 'Mapped standardsMap ID during import normalization.');
    } else if (nonEmptyString(normalized.description)) {
      normalized = addNormalizationNote(normalized, `Standards map entry ${index + 1} still needs a standard ID before approval.`);
    }
  }
  return normalizeReviewFields({
    ...normalized,
    standards: makeDefaultStandardsMetadata(),
    relatedVocabulary: Array.isArray(normalized.relatedVocabulary) ? normalized.relatedVocabulary : [],
    relatedConcepts: Array.isArray(normalized.relatedConcepts) ? normalized.relatedConcepts : []
  });
}

function normalizeSmokeTest(item, index = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  let normalized = { ...item };
  if (!nonEmptyString(normalized.smokeTestId) && nonEmptyString(normalized.question)) {
    normalized.smokeTestId = makeGeneratedItemId('smoke-test', [
      normalized.question,
      normalized.expectedAnswer,
      normalized.expectedRoute
    ], index, {});
    normalized = addNormalizationNote(normalized, 'Generated smoke test ID during import normalization.');
  }
  return normalizeReviewFields({
    ...normalized,
    standards: makeDefaultStandardsMetadata()
  });
}

function dedupeDraftItems(pack) {
  const rules = {
    concepts: conceptKey,
    problemBank: problemKey
  };
  const stats = {};
  const rawVocabulary = Array.isArray(pack.vocabulary) ? pack.vocabulary : [];
  pack.vocabulary = mergeVocabularyItems(rawVocabulary);
  stats.vocabulary = {
    raw: rawVocabulary.length,
    duplicatesRemoved: rawVocabulary.length - pack.vocabulary.length,
    final: pack.vocabulary.length
  };
  Object.entries(rules).forEach(([sectionName, makeKey]) => {
    const rawItems = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    const deduped = sectionName === 'concepts' ? mergeConceptItems(rawItems) : mergeUniqueObjects(rawItems, makeKey);
    pack[sectionName] = deduped;
    stats[sectionName] = {
      raw: rawItems.length,
      duplicatesRemoved: rawItems.length - deduped.length,
      final: deduped.length
    };
  });
  return stats;
}

function mergeSourceEvidence(target, duplicate) {
  if (!target || !duplicate) return target;
  const references = [
    ...(Array.isArray(target.sourceReferences) ? target.sourceReferences : [makeSourceReference(target)]),
    makeSourceReference(duplicate)
  ].filter((reference) => reference.sourceFile || reference.sourceLocation || reference.sourceTextSnippet);
  target.sourceReferences = mergeUniqueSourceReferences(references);
  if (!nonEmptyString(target.sourceTextSnippet) && nonEmptyString(duplicate.sourceTextSnippet)) {
    target.sourceTextSnippet = duplicate.sourceTextSnippet;
  }
  if (!nonEmptyString(target.sourceLocation) && nonEmptyString(duplicate.sourceLocation)) {
    target.sourceLocation = duplicate.sourceLocation;
  }
  return target;
}

function mergeVocabularyDuplicate(target, duplicate) {
  mergeSourceEvidence(target, duplicate);
  const aliases = [
    target.aliases,
    duplicate.aliases,
    target.term !== duplicate.term ? duplicate.term : ''
  ];
  target.aliases = normalizeAliasList(aliases, target.term);
  if (!nonEmptyString(target.studentDefinition) && nonEmptyString(duplicate.studentDefinition)) {
    target.studentDefinition = duplicate.studentDefinition;
  }
  if (!nonEmptyString(target.teacherDefinition) && nonEmptyString(duplicate.teacherDefinition)) {
    target.teacherDefinition = duplicate.teacherDefinition;
  }
  if (!nonEmptyString(target.exampleQuestion) && nonEmptyString(duplicate.exampleQuestion)) {
    target.exampleQuestion = duplicate.exampleQuestion;
  }
  if (!nonEmptyString(target.exampleAnswer) && nonEmptyString(duplicate.exampleAnswer)) {
    target.exampleAnswer = duplicate.exampleAnswer;
  }
  return target;
}

function mergeConceptDuplicate(target, duplicate) {
  mergeSourceEvidence(target, duplicate);
  if (
    !nonEmptyString(target.studentExplanation)
    || looksTruncatedGeneratedText(target.studentExplanation)
    || (duplicate && /^deterministic_/iu.test(String(duplicate.sourceParse || '')) && isCleanerDeterministicConceptExplanation(duplicate.studentExplanation, target.studentExplanation))
  ) {
    if (nonEmptyString(duplicate.studentExplanation) && !looksTruncatedGeneratedText(duplicate.studentExplanation)) {
      target.studentExplanation = duplicate.studentExplanation;
    }
  }
  if (!Array.isArray(target.keyIdeas) || target.keyIdeas.length === 0) {
    target.keyIdeas = Array.isArray(duplicate.keyIdeas) ? duplicate.keyIdeas : [];
  }
  if (!Array.isArray(target.examples) || target.examples.length === 0) {
    target.examples = Array.isArray(duplicate.examples) ? duplicate.examples : [];
  }
  if (target.reviewStatus === 'needs_review' || duplicate.reviewStatus === 'needs_review') {
    target.reviewStatus = 'needs_review';
  }
  if (target.confidence === 'low' || duplicate.confidence === 'low') {
    target.confidence = 'low';
  }
  return target;
}

function isCleanerDeterministicConceptExplanation(candidate, current) {
  const next = String(candidate || '').replace(/\s+/g, ' ').trim();
  const existing = String(current || '').replace(/\s+/g, ' ').trim();
  if (!next || !existing) return false;
  if (/^if\b/iu.test(existing) && !/^if\b/iu.test(next)) return true;
  if (/draft wording not available/iu.test(existing)) return true;
  return next.length + 20 < existing.length;
}

function preserveStricterReviewState(target, existing) {
  if (!target || !existing) return target;
  if (existing.reviewStatus === 'needs_review' || existing.confidence === 'low') {
    target.reviewStatus = 'needs_review';
    target.confidence = 'low';
  }
  if (Array.isArray(existing.normalizationNotes) && existing.normalizationNotes.length) {
    target.normalizationNotes = Array.from(new Set([
      ...(Array.isArray(target.normalizationNotes) ? target.normalizationNotes : []),
      ...existing.normalizationNotes
    ]));
  }
  if (nonEmptyString(existing.notes) && !String(target.notes || '').includes(existing.notes)) {
    target.notes = [target.notes, existing.notes].filter(nonEmptyString).join(' ');
  }
  return target;
}

function makeSourceReference(item) {
  return {
    sourceFile: String(item && item.sourceFile || ''),
    sourceLocation: String(item && item.sourceLocation || ''),
    sourceTextSnippet: String(item && item.sourceTextSnippet || '')
  };
}

function mergeUniqueSourceReferences(references) {
  const seen = new Set();
  const unique = [];
  references.forEach((reference) => {
    const key = [
      normalizeKey(reference.sourceFile),
      normalizeKey(reference.sourceLocation),
      normalizeItemKey(reference.sourceTextSnippet)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(reference);
  });
  return unique;
}

function normalizeTermAliases({ label, aliases, sourceTextSnippet }) {
  const extracted = extractParentheticalAliases(label);
  let cleanLabel = nonEmptyString(label) ? String(label).trim() : '';
  if (extracted.cleanLabel) cleanLabel = extracted.cleanLabel;
  const sourceAliases = extractSourceParentheticalAliases(cleanLabel, sourceTextSnippet);
  return {
    label: cleanLabel,
    aliases: normalizeAliasList([aliases, extracted.aliases, sourceAliases], cleanLabel)
  };
}

function normalizeAliasList(values, canonicalLabel = '') {
  const flattened = flattenAliasValues(values);
  const canonicalKey = normalizeItemKey(canonicalLabel);
  const seen = new Set();
  const aliases = [];
  flattened.forEach((value) => {
    const alias = String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!alias) return;
    const key = normalizeItemKey(alias);
    if (!key || key === canonicalKey || seen.has(key)) return;
    seen.add(key);
    aliases.push(alias.slice(0, 80));
  });
  return aliases;
}

function flattenAliasValues(values) {
  const output = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === 'object') return;
    if (nonEmptyString(value)) output.push(value);
  };
  visit(values);
  return output;
}

function extractParentheticalAliases(value) {
  const label = nonEmptyString(value) ? String(value).trim() : '';
  const match = label.match(/^(.+?)\s*\(([^()]{1,16})\)\s*$/u);
  if (!match || !looksLikeAlias(match[2])) {
    return { cleanLabel: label, aliases: [] };
  }
  return {
    cleanLabel: match[1].trim(),
    aliases: [match[2].trim()]
  };
}

function stripParentheticalAlias(value) {
  return extractParentheticalAliases(value).cleanLabel || String(value || '');
}

function extractSourceParentheticalAliases(label, sourceTextSnippet) {
  if (!nonEmptyString(label) || !nonEmptyString(sourceTextSnippet)) return [];
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*\\(([^()]{1,16})\\)`, 'ig');
  const aliases = [];
  let match;
  while ((match = pattern.exec(sourceTextSnippet)) !== null) {
    if (looksLikeAlias(match[1])) aliases.push(match[1].trim());
  }
  return aliases;
}

function looksLikeAlias(value) {
  const alias = String(value || '').trim();
  if (!alias || /\s/.test(alias) || alias.length > 12) return false;
  return /^[A-Za-z0-9µΩ°%./^_-]+$/u.test(alias);
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addSourceDerivedVocabulary(pack, extraction, sourceDefaults) {
  const candidates = extractVocabularyCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.vocabulary) ? pack.vocabulary : [])
    .map((item, index) => [canonicalVocabularyKey(item && item.term), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const key = canonicalVocabularyKey(candidate.term);
    if (!key) return;
    const deterministicItem = normalizeVocabularyItem({
      vocabId: makeGeneratedItemId('vocab', [candidate.term], index, sourceDefaults),
      term: candidate.term,
      aliases: [],
      studentDefinition: candidate.definition,
      teacherDefinition: candidate.definition,
      misconception: '',
      exampleQuestion: '',
      exampleAnswer: '',
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: 'deterministic_vocabulary_section',
      normalizationNotes: ['Deterministically parsed from a Vocabulary Term: definition source line.']
    }, sourceDefaults, index);
    if (existing.has(key)) {
      const existingIndex = existing.get(key);
      pack.vocabulary[existingIndex] = mergeVocabularyDuplicate(deterministicItem, pack.vocabulary[existingIndex]);
      existing.set(key, existingIndex);
      return;
    }
    existing.set(key, pack.vocabulary.length);
    pack.vocabulary.push(deterministicItem);
  });
}

function extractVocabularyCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    let inVocabulary = false;
    splitSourceLines(section.text).forEach((line) => {
      const cleaned = cleanSourceLine(line);
      if (!cleaned) return;
      if (isVocabularySectionLabel(cleaned)) {
        inVocabulary = true;
        return;
      }
      const sectionLabel = detectSourceSectionLabel(cleaned);
      if (sectionLabel) {
        inVocabulary = sectionLabel === 'vocabulary';
        if (inVocabulary) {
          const afterLabel = stripLeadingSectionLabel(cleaned, VOCAB_SECTION_LABEL_PATTERN);
          const inline = parseVocabularyDefinitionLine(afterLabel, { allowPredicateDefinition: false });
          if (inline) pushVocabularyCandidate(candidates, inline, section, cleaned);
        }
        return;
      }
      const parsed = parseVocabularyDefinitionLine(cleaned);
      if (parsed && (inVocabulary || looksStandaloneVocabularyDefinition(parsed, cleaned))) {
        pushVocabularyCandidate(candidates, parsed, section, cleaned);
      }
    });
  });
  return mergeVocabularyCandidates(candidates);
}

function looksStandaloneVocabularyDefinition(parsed, sourceLine) {
  if (!/:/.test(String(sourceLine || ''))) return false;
  const term = normalizeVocabularyTermFromSource(parsed && parsed.term);
  const definition = normalizeRecoveredDefinitionText(parsed && parsed.definition, term);
  if (!term || !definition) return false;
  if (isVocabularySectionLabel(term)) return false;
  if (detectSourceSectionLabel(term)) return false;
  if (isReviewOrMetadataLine(sourceLine)) return false;
  if (/^(?:purpose|expected behavior|teacher import note|testing note|reference|example)$/iu.test(term)) return false;
  if (/^(?:students?|look for|extract|do not)\b/iu.test(definition)) return false;
  if (looksFormulaLikeVocabularyLine(term, definition)) return false;
  const termWords = term.split(/\s+/u).length;
  return termWords <= 4 && definition.length >= 8 && definition.length <= 180;
}

function pushVocabularyCandidate(candidates, parsed, section, sourceLine) {
  const term = normalizeVocabularyTermFromSource(parsed.term);
  const definition = normalizeRecoveredDefinitionText(parsed.definition, term);
  if (!term || !definition) return;
  if (isVocabularySectionLabel(term)) return;
  if (isFormulaVariableVocabularyTerm(term)) return;
  if (looksFormulaLikeVocabularyLine(term, definition)) return;
  candidates.push({
    term,
    definition,
    confidence: 'high',
    sourceFile: section.sourceFile,
    sourceLocation: section.sourceLocation,
    sourceTextSnippet: sourceLine.slice(0, 240)
  });
}

function splitSourceLines(text) {
  return String(text || '')
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanSourceLine(line) {
  return String(line || '')
    .normalize('NFKC')
    .replace(/[•●▪]/gu, '-')
    .replace(/^\s*l\s+(?=[A-Z])/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSourceSectionLabel(line) {
  const cleaned = cleanSourceLine(line).replace(/^[*\-\d.)\s]+/u, '').trim();
  if (!cleaned) return '';
  const bareLabel = normalizeItemKey(cleaned.replace(/[:\-]\s*.*$/u, ''));
  if (new RegExp(`^${VOCAB_SECTION_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'vocabulary';
  if (new RegExp(`^${CONCEPT_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'concept';
  if (new RegExp(`^${FORMULA_LABEL_PATTERN}\\b`, 'iu').test(cleaned)) return 'formula';
  if (/^(?:examples?|practice|review)\b/iu.test(cleaned)) return 'other';
  if (REJECTED_VOCAB_LABEL_KEYS.has(bareLabel)) return 'other';
  return '';
}

function stripLeadingSectionLabel(line, labelPattern) {
  return cleanSourceLine(line)
    .replace(new RegExp(`^${labelPattern}\\s*[:\\-]?\\s*`, 'iu'), '')
    .trim();
}

function parseVocabularyDefinitionLine(line, options = {}) {
  const value = cleanSourceLine(line);
  const match = value.match(/^[*\-\d.)\s]*([^:]{1,80})\s*:\s*(.{4,260})$/u)
    || (options.allowPredicateDefinition === false
      ? null
      : value.match(/^[*\-\d.)\s]*([A-Z][\p{L}\p{N}/'’() -]{1,80}?)\s+(?:is|are|means|refers to|is defined as)\s+(.{4,260})$/u));
  if (!match) return null;
  return {
    term: match[1],
    definition: match[2]
  };
}

function normalizeVocabularyTermFromSource(value) {
  const term = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:,]+$/u, '')
    .trim();
  if (!term || term.length > 80) return '';
  if (term.split(/\s+/).length > 6) return '';
  if (/[=]/u.test(term)) return '';
  return term;
}

function mergeVocabularyCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = canonicalVocabularyKey(candidate.term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function addSourceDerivedReferenceFormulas(pack, extraction, sourceDefaults) {
  const candidates = extractFormulaCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas : [])
    .map((item, index) => [normalizeFormulaEquation(item && item.equation), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const equationKey = normalizeFormulaEquation(candidate.equation);
    if (!equationKey) return;
    const deterministicItem = normalizeReferenceFormula({
      formulaId: makeGeneratedItemId('formula', [candidate.equation], index, sourceDefaults),
      title: makeFormulaTitle(candidate.equation, index),
      equation: candidate.equation,
      variables: candidate.variables,
      studentExplanation: 'Reference formula extracted from the uploaded source for teacher review.',
      solverStatus: 'reference_only',
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: candidate.sourceParse || 'deterministic_formula_line',
      normalizationNotes: ['Deterministically parsed from a labeled source formula line.']
    }, sourceDefaults);
    if (existing.has(equationKey)) {
      const existingIndex = existing.get(equationKey);
      pack.referenceFormulas[existingIndex] = preserveStricterReviewState(
        mergeSourceEvidence(deterministicItem, pack.referenceFormulas[existingIndex]),
        pack.referenceFormulas[existingIndex]
      );
      existing.set(equationKey, existingIndex);
      return;
    }
    existing.set(equationKey, pack.referenceFormulas.length);
    pack.referenceFormulas.push(deterministicItem);
  });
}

function addSourceDerivedConcepts(pack, extraction, sourceDefaults) {
  const candidates = extractConceptCandidates(extraction, sourceDefaults);
  if (!candidates.length) return;
  const existing = new Map((Array.isArray(pack.concepts) ? pack.concepts : [])
    .map((item, index) => [normalizeItemKey(item && item.title), index])
    .filter(([key]) => key));
  candidates.forEach((candidate, index) => {
    const key = normalizeItemKey(candidate.title);
    if (!key) return;
    const deterministicItem = normalizeConceptItem({
      conceptId: makeGeneratedItemId('concept', [candidate.title], index, sourceDefaults),
      title: candidate.title,
      aliases: [],
      studentExplanation: candidate.studentExplanation,
      keyIdeas: [],
      examples: [],
      nonExamples: [],
      commonMisconceptions: [],
      reviewStatus: 'pending',
      confidence: candidate.confidence,
      sourceFile: candidate.sourceFile || sourceDefaults.sourceFile,
      sourceLocation: candidate.sourceLocation || sourceDefaults.sourceLocation,
      sourceTextSnippet: candidate.sourceTextSnippet,
      sourceParse: candidate.sourceParse || 'deterministic_concept_section',
      normalizationNotes: ['Deterministically parsed from a labeled concept source section.']
    }, sourceDefaults);
    if (existing.has(key)) {
      const existingIndex = existing.get(key);
      pack.concepts[existingIndex] = preserveStricterReviewState(
        mergeSourceEvidence(deterministicItem, pack.concepts[existingIndex]),
        pack.concepts[existingIndex]
      );
      existing.set(key, existingIndex);
      return;
    }
    existing.set(key, pack.concepts.length);
    pack.concepts.push(deterministicItem);
  });
}

function extractConceptCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    const lines = splitSourceLines(section.text).map(cleanSourceLine).filter(Boolean);
    lines.forEach((line, lineIndex) => {
      const marker = matchConceptSectionLabel(line);
      if (!marker) return;
      const inlineTitle = stripLeadingSectionLabel(line, CONCEPT_LABEL_PATTERN);
      const nextLine = lines[lineIndex + 1] || '';
      const title = normalizeConceptHeading(inlineTitle || nextLine || marker.label);
      const explanation = extractConceptExplanationFromLines(lines, lineIndex, title, inlineTitle);
      if (!title || !explanation) return;
      candidates.push({
        title,
        studentExplanation: explanation,
        confidence: 'medium',
        sourceFile: section.sourceFile,
        sourceLocation: section.sourceLocation,
        sourceTextSnippet: [line, explanation].filter(Boolean).join(' ').slice(0, 240),
        sourceParse: 'deterministic_concept_section'
      });
    });
    extractStructuredSectionConceptCandidates(lines, section).forEach((candidate) => candidates.push(candidate));
  });
  extractDensityBuoyancyCandidates(sections).forEach((candidate) => candidates.push(candidate));
  extractPlateTectonicsBroadConceptCandidate(sections, sourceDefaults).forEach((candidate) => candidates.push(candidate));
  return mergeConceptCandidates(candidates);
}

function matchConceptSectionLabel(line) {
  const match = cleanSourceLine(line).match(new RegExp(`^(${CONCEPT_LABEL_PATTERN})\\b`, 'iu'));
  if (!match) return null;
  return {
    label: String(match[1] || '').trim(),
    key: normalizeItemKey(match[1] || '')
  };
}

function extractStructuredSectionConceptCandidates(lines, section) {
  const candidates = [];
  let activeConceptSection = '';
  lines.forEach((line) => {
    const conceptLabel = matchConceptSectionLabel(line);
    if (conceptLabel) {
      activeConceptSection = conceptLabel.key;
      const inline = stripLeadingSectionLabel(line, CONCEPT_LABEL_PATTERN);
      const inlineCandidate = makeStructuredConceptCandidate(inline, activeConceptSection, section, line);
      if (inlineCandidate) candidates.push(inlineCandidate);
      return;
    }
    const sectionType = detectSourceSectionLabel(line);
    if (sectionType && sectionType !== 'concept') {
      activeConceptSection = '';
      return;
    }
    if (!activeConceptSection) return;
    const candidate = makeStructuredConceptCandidate(line, activeConceptSection, section, line);
    if (candidate) candidates.push(candidate);
  });
  return candidates;
}

function makeStructuredConceptCandidate(value, sectionLabelKey, section, sourceLine) {
  const explanation = normalizeStructuredConceptExplanation(value);
  if (!explanation) return null;
  const title = deriveStructuredConceptTitle(explanation, sectionLabelKey);
  if (!title) return null;
  if (isVocabularySectionLabel(title)) return null;
  return {
    title,
    studentExplanation: explanation,
    confidence: 'medium',
    sourceFile: section.sourceFile,
    sourceLocation: section.sourceLocation,
    sourceTextSnippet: String(sourceLine || explanation).slice(0, 240),
    sourceParse: 'deterministic_structured_concept_section'
  };
}

function normalizeStructuredConceptExplanation(value) {
  const stripped = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleaned = cleanConceptSourceSentence(stripped);
  if (!cleaned) return '';
  if (isVocabularySectionLabel(cleaned)) return '';
  if (looksSlideHeaderLine(cleaned) || isPageHeaderText(cleaned)) return '';
  if (isReviewOrMetadataLine(cleaned)) return '';
  if (cleaned.length < 20) return '';
  if (!/[A-Za-z]/u.test(cleaned)) return '';
  return cleaned;
}

function deriveStructuredConceptTitle(explanation, sectionLabelKey = '') {
  const raw = String(explanation || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const timelineMatch = raw.match(/^(\d{3,4})\s*[:\-]\s*(.+)$/u);
  if (timelineMatch) {
    const summary = summarizeConceptTitleText(timelineMatch[2], 6);
    const title = `${timelineMatch[1]} ${summary}`.trim();
    return normalizeConceptHeading(title);
  }
  let summarySeed = raw.replace(/\b(?:because|therefore|thus|which led to|led to|leading to|resulting in)\b[\s\S]*$/iu, '').trim();
  if (!summarySeed || summarySeed.split(/\s+/u).length < 2) summarySeed = raw;
  const summary = summarizeConceptTitleText(summarySeed, sectionLabelKey.includes('cause') ? 7 : 8);
  return normalizeConceptHeading(summary);
}

function summarizeConceptTitleText(value, maxWords = 8) {
  const plain = String(value || '')
    .replace(/^[*\-\d.)\s]+/u, '')
    .replace(/[.;:,]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  const words = plain.split(/\s+/u).filter(Boolean).slice(0, maxWords);
  return toTitleWords(words.join(' '));
}

function extractDensityBuoyancyCandidates(sections) {
  const candidates = [];
  const combined = sections.map((section) => String(section.text || '')).join(' ');
  const hasSink = /\b(?:greater|higher|more)\s+density\b[^.]{0,80}\bsink|denser than\b[^.]{0,80}\bsink/iu.test(combined);
  const hasFloat = /\b(?:lower|less)\s+density\b[^.]{0,80}\bfloat|less dense than\b[^.]{0,80}\bfloat/iu.test(combined);
  const hasDisplacementVolume = /\bwater displacement\b[^.]{0,120}\bvolume\b|\bdisplaced water\b[^.]{0,120}\bvolume\b/iu.test(combined);
  const hasBuoyantForce = /\bbuoyant force\b[^.]{0,120}\bdisplac(?:ed|ement)\b|\bfluid displaced\b/iu.test(combined);
  const anchor = sections.find((section) => /density|buoy|displacement|fluid/iu.test(String(section.text || ''))) || sections[0];
  if (!anchor) return candidates;
  if (hasSink) {
    candidates.push({
      title: 'Objects Denser Than the Fluid Sink',
      studentExplanation: 'Objects denser than the fluid usually sink.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasFloat) {
    candidates.push({
      title: 'Objects Less Dense Than the Fluid Float',
      studentExplanation: 'Objects less dense than the fluid usually float.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasDisplacementVolume) {
    candidates.push({
      title: 'Water Displacement and Volume',
      studentExplanation: 'Water displacement can be used to find an object’s volume.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  if (hasBuoyantForce) {
    candidates.push({
      title: 'Buoyant Force and Displaced Fluid',
      studentExplanation: 'Buoyant force is related to the amount of fluid displaced by an object.',
      confidence: 'medium',
      sourceFile: anchor.sourceFile,
      sourceLocation: anchor.sourceLocation,
      sourceTextSnippet: String(anchor.text || '').slice(0, 240)
    });
  }
  return candidates;
}

function extractPlateTectonicsBroadConceptCandidate(sections, sourceDefaults = {}) {
  const combined = sections.map((section) => String(section.text || '')).join(' ');
  const context = `${sourceDefaults.sourceFile || ''} ${combined}`.replace(/[_-]+/gu, ' ');
  const hasPlateTectonicsContext = /\bplate tectonics\b/iu.test(context);
  const hasLithosphereAndPlates = /\blithosphere\b/iu.test(combined) && /\bplates?\s+move\b|\btectonic plates?\b/iu.test(combined);
  const hasBoundaries = /\b(?:divergent|convergent|transform)\s+boundar/iu.test(combined);
  const hasLandformsOrHazards = /\blandforms?\b|\bhazards?\b|\bvolcano(?:es)?\b|\bearthquakes?\b|\bmountains?\b|\btrenches?\b|\brift valleys?\b|\bmid-ocean ridges?\b/iu.test(combined);
  if (!hasPlateTectonicsContext || !hasLithosphereAndPlates || !hasBoundaries || !hasLandformsOrHazards) return [];
  const anchor = sections.find((section) => /\blithosphere\b|\bplates?\s+move\b|\bboundar/iu.test(String(section.text || ''))) || sections[0];
  if (!anchor) return [];
  return [{
    title: 'Plate Tectonics',
    studentExplanation: 'Plate tectonics explains how Earth’s lithosphere is broken into moving plates that form boundaries, landforms, and hazards.',
    confidence: 'medium',
    sourceFile: anchor.sourceFile,
    sourceLocation: anchor.sourceLocation,
    sourceTextSnippet: String(anchor.text || combined).slice(0, 240),
    sourceParse: 'deterministic_plate_tectonics_broad_concept'
  }];
}

function normalizeConceptHeading(value) {
  const heading = String(value || '').replace(/\s+/g, ' ').trim();
  return cleanConceptTitle(heading);
}

function extractConceptExplanationFromLines(lines, headingIndex, headingTitle, inlineText = '') {
  const buffer = [];
  const inlineSentence = cleanConceptSourceSentence(inlineText);
  if (inlineSentence && !isLearningTargetSentence(inlineSentence)) {
    buffer.push(inlineSentence);
  }
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = String(lines[index] || '').trim();
    if (!line) continue;
    if (new RegExp(`^${CONCEPT_LABEL_PATTERN}\\b`, 'iu').test(line)) break;
    if (new RegExp(`^(?:${VOCAB_SECTION_LABEL_PATTERN}|${FORMULA_LABEL_PATTERN}|equation|examples?|practice|review)\\b`, 'iu').test(line) && buffer.length > 0) break;
    const cleaned = cleanConceptSourceSentence(line);
    if (!cleaned) continue;
    if (isLearningTargetSentence(cleaned) && buffer.length > 0) continue;
    buffer.push(cleaned);
    if (buffer.join(' ').length >= 220) break;
  }
  const text = buffer.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentence = (text.split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .find((part) => part && !looksSlideHeaderLine(part) && !isPageHeaderText(part) && !isLearningTargetSentence(part)) || text).trim();
  if (!sentence || normalizeItemKey(sentence) === normalizeItemKey(headingTitle)) return '';
  return sentence;
}

function cleanConceptSourceSentence(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || looksSlideHeaderLine(text) || isPageHeaderText(text)) return '';
  text = text.replace(new RegExp(`^${CONCEPT_LABEL_PATTERN}\\s*[:\\-]?\\s*`, 'iu'), '').trim();
  if (!text || looksSlideHeaderLine(text) || isPageHeaderText(text) || isReviewOrMetadataLine(text)) return '';
  return text;
}

function mergeConceptCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = normalizeItemKey(candidate.title);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function recoverConceptExplanationsFromSource(pack, extraction) {
  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  concepts.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const current = String(item.studentExplanation || '').trim();
    const needsRecovery = !current || /draft wording not available/i.test(current) || isLearningTargetSentence(current) || looksTruncatedGeneratedText(current);
    if (!needsRecovery) return;
    const evidence = makeItemEvidenceText(item, extraction);
    const recovered = recoverConceptExplanationText(item, evidence);
    if (!recovered) return;
    item.studentExplanation = recovered;
    if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
    if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
  });
}

function recoverVocabularyDefinitionsFromSource(pack, extraction) {
  const vocabulary = Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : [];
  vocabulary.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    if (hasQuarantineMarker(item)) return;
    const missingStudent = isMissingDraftWordingValue(item.studentDefinition);
    const missingTeacher = isMissingDraftWordingValue(item.teacherDefinition);
    if (!missingStudent && !missingTeacher) return;
    const evidence = makeItemEvidenceText(item, extraction);
    const recovered = recoverVocabularyDefinitionText(item, evidence, extraction);
    if (!recovered) return;
    if (missingStudent) item.studentDefinition = recovered;
    if (missingTeacher) item.teacherDefinition = recovered;
    if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
    if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
  });
}

function cleanupConceptTitles(pack, extraction, importProfile = 'general') {
  const concepts = Array.isArray(pack && pack.concepts) ? pack.concepts : [];
  const invalidItems = [];
  const filtered = [];
  concepts.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const evidence = makeItemEvidenceText(item, extraction);
    let cleaned = cleanConceptTitle(firstNonEmptyString(item.title), {
      explanation: firstNonEmptyString(item.studentExplanation),
      evidence
    });
    if (isReviewOrMetadataConceptItem(item, evidence)) {
      invalidItems.push({
        section: 'concepts',
        index,
        reason: `Concept title "${firstNonEmptyString(item.title, '(missing)')}" looked like slide metadata or review/check instructions, not student knowledge.`,
        requiredField: 'title'
      });
      return;
    }
    if (importProfile === 'physical_science' && isInvalidPhysicalScienceConceptTitle(cleaned)) {
      cleaned = cleanConceptTitle(deriveShortTitle([item.studentExplanation, evidence]), {
        explanation: firstNonEmptyString(item.studentExplanation),
        evidence
      });
    }
    if (!cleaned || (importProfile === 'physical_science' && isInvalidPhysicalScienceConceptTitle(cleaned))) {
      invalidItems.push({
        section: 'concepts',
        index,
        reason: `Concept title "${firstNonEmptyString(item.title, '(missing)')}" was not a usable science concept title.`,
        requiredField: 'title'
      });
      return;
    }
    if (cleaned && cleaned !== item.title) {
      item.title = cleaned;
      if (!['pending', 'needs_review'].includes(item.reviewStatus)) item.reviewStatus = 'needs_review';
      if (!['high', 'medium', 'low'].includes(item.confidence)) item.confidence = 'low';
    }
    filtered.push(item);
  });
  pack.concepts = filtered;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function recoverConceptExplanationText(item, evidenceText) {
  const evidence = cleanConceptEvidenceText(evidenceText);
  if (!evidence) return '';
  const title = firstNonEmptyString(item && item.title, item && item.conceptId);
  const sentences = evidence
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 260)
    .filter((sentence) => !isLearningTargetSentence(sentence))
    .filter((sentence) => !looksSlideHeaderLine(sentence));
  if (/electric charge/i.test(title)) {
    const chargeSentence = sentences.find((sentence) => /like charges?.{0,60}repel|opposite charges?.{0,60}attract/iu.test(sentence));
    if (chargeSentence) return chargeSentence;
  }
  if (/ohm/i.test(title)) {
    const ohmSentence = sentences.find((sentence) => /voltage|current|resistance/iu.test(sentence));
    if (ohmSentence) return ohmSentence;
  }
  if (/series circuit/i.test(title)) {
    const seriesSentence = sentences.find((sentence) => /(one|single).{0,40}(path|loop)|opens?.{0,40}current|if .*open/iu.test(sentence));
    if (seriesSentence) return seriesSentence;
  }
  if (looksTruncatedGeneratedText(item && item.studentExplanation)) {
    const repaired = recoverSourceSentenceForFragment(item.studentExplanation, evidence);
    if (repaired) return repaired;
  }
  const withTitle = sentences.find((sentence) => phraseAppearsInText(title, sentence) && !looksHeadingOnlyEvidence(title, sentence));
  if (withTitle) return withTitle;
  const general = sentences.find((sentence) => !looksHeadingOnlyEvidence(title, sentence));
  return general || '';
}

function cleanConceptEvidenceText(value) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/\bLarger PDF:\s*Electricity and Magnetism\s+Page\s+\d+\s+of\s+\d+\b\.?/giu, ' ');
  text = text.replace(/\bCharlemagne text-based PDF import test\b\.?/giu, ' ');
  text = text.replace(/\b(?:Core Concept|Concept Check|Key Idea|Important Idea|Main Idea)\s*:\s*/giu, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function applyVocabularyQualityGates(pack, extraction, importProfile = 'general') {
  const blockedTerms = new Set([
    'more mass',
    'more speed',
    '0 n',
    'f ma',
    'x r',
    'm in 20 s',
    'mass per unit volume'
  ]);
  const evidenceText = normalizeItemKey(extraction && extraction.text || '');
  const filtered = [];
  const invalidItems = [];
  (Array.isArray(pack && pack.vocabulary) ? pack.vocabulary : []).forEach((item, index) => {
    const verdict = evaluateVocabularyCandidate(item, blockedTerms, evidenceText, extraction, importProfile);
    if (verdict.accepted) {
      filtered.push(item);
      return;
    }
    invalidItems.push({
      section: 'vocabulary',
      index,
      reason: verdict.reason,
      requiredField: 'term'
    });
  });
  pack.vocabulary = filtered;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function evaluateVocabularyCandidate(item, blockedTerms, extractionText, extraction, importProfile = 'general') {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { accepted: false, reason: 'Entry was not a JSON object.' };
  }
  const rawTerm = cleanScienceExtractionArtifactText(String(item.term || '').replace(/\s+/g, ' ').trim(), importProfile);
  const term = normalizeItemKey(rawTerm);
  if (!term) return { accepted: false, reason: 'Missing required term.' };
  if (isVocabularySectionLabel(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" matched a section label.` };
  }
  if (looksBrokenVocabularyFragment(rawTerm, term)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a broken label fragment.` };
  }
  if (blockedTerms.has(term)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a fragment/example, not a science term.` };
  }
  if (/^[0-9.+\-/% ]+[a-z°µΩ]+$/iu.test(rawTerm) || /[=]/u.test(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a unit/equation fragment.` };
  }
  if (isFormulaVariableVocabularyTerm(rawTerm) && !hasExplicitStandaloneVocabularyDefinition(rawTerm, extraction)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a formula variable, not a standalone vocabulary term.` };
  }
  if (/^(?:circuit|magnet)$/iu.test(rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" was too broad without a more specific source term.` };
  }
  if (/^(?:charges|symbols|batteries)$/iu.test(rawTerm) && looksListFragmentEvidence(item.sourceTextSnippet, rawTerm)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like a list fragment, not a standalone term.` };
  }
  if (/^(?:charges|symbols|batteries)$/iu.test(rawTerm) && !phraseAppearsInText(rawTerm, extractionText)) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" lacked clear standalone glossary context.` };
  }
  if (rawTerm.split(/\s+/).length > 5) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" looked like sentence wording, not a term.` };
  }
  const studentDefinition = cleanScienceExtractionArtifactText(String(item.studentDefinition || '').trim(), importProfile);
  const teacherDefinition = cleanScienceExtractionArtifactText(String(item.teacherDefinition || '').trim(), importProfile);
  const usableStudent = !isMissingDraftWordingValue(studentDefinition);
  const usableTeacher = !isMissingDraftWordingValue(teacherDefinition);
  if (!usableStudent || !usableTeacher) {
    return { accepted: false, reason: `Vocabulary term "${rawTerm}" was missing a usable definition.` };
  }
  item.term = rawTerm;
  item.studentDefinition = studentDefinition;
  item.teacherDefinition = teacherDefinition;
  return { accepted: true };
}

function looksBrokenVocabularyFragment(rawTerm, normalizedTerm) {
  if (!nonEmptyString(rawTerm)) return true;
  if (/^(?:use|se alignment|alignment|concepts?|vocabulary)$/iu.test(rawTerm)) return true;
  if (/^(?:useful|key|core|main|review)\s+(?:terms?|items?|concepts?|vocabulary)$/iu.test(rawTerm)) return true;
  if (/^se\s+\w+$/iu.test(rawTerm)) return true;
  if (normalizedTerm.length < 2) return true;
  return false;
}

function isFormulaVariableVocabularyTerm(value) {
  return FORMULA_VARIABLE_VOCAB_KEYS.has(normalizeItemKey(value));
}

function looksFormulaLikeVocabularyLine(term, definition) {
  const text = `${term} ${definition}`;
  return /[=≈]/u.test(text) || /\b(?:formula|equation|ohm'?s law)\b/iu.test(definition);
}

function hasExplicitStandaloneVocabularyDefinition(term, extraction) {
  const key = canonicalVocabularyKey(term);
  if (!key) return false;
  const sections = makeFormulaSourceSections(extraction, makeSourceDefaults(extraction));
  return sections.some((section) => {
    let inVocabulary = false;
    return splitSourceLines(section.text).some((line) => {
      const cleaned = cleanSourceLine(line);
      if (!cleaned) return false;
      const sectionLabel = detectSourceSectionLabel(cleaned);
      if (sectionLabel) {
        inVocabulary = sectionLabel === 'vocabulary';
        if (!inVocabulary) return false;
      }
      if (!inVocabulary) return false;
      const parsed = parseVocabularyDefinitionLine(stripLeadingSectionLabel(cleaned, VOCAB_SECTION_LABEL_PATTERN));
      if (!parsed) return false;
      if (canonicalVocabularyKey(parsed.term) !== key) return false;
      return !looksFormulaLikeVocabularyLine(parsed.term, parsed.definition);
    });
  });
}

function looksListFragmentEvidence(snippet, term) {
  const text = String(snippet || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  const listish = /,|\band\b|•|;/.test(text);
  const termPattern = new RegExp(`\\b${escapeRegExp(String(term || '').trim())}\\b`, 'iu');
  const definitionPattern = new RegExp(`\\b${escapeRegExp(String(term || '').trim())}\\b[^.!?]{0,50}\\b(?:is|are|means|refers to|defined as)\\b`, 'iu');
  return listish && termPattern.test(text) && !definitionPattern.test(text);
}

function applyFormulaQualityGates(pack, extraction, importProfile = 'general') {
  const formulas = Array.isArray(pack && pack.referenceFormulas) ? pack.referenceFormulas : [];
  const filtered = [];
  const invalidItems = [];
  const additional = [];
  formulas.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      invalidItems.push({
        section: 'referenceFormulas',
        index,
        reason: 'Entry was not a JSON object.',
        requiredField: 'title/equation'
      });
      return;
    }
    const repaired = repairReferenceEquation(item.equation, [
      item.sourceTextSnippet,
      item.studentExplanation,
      item.notes,
      extraction && extraction.text
    ].filter(nonEmptyString).join(' '), importProfile);
    if (repaired.invalidReason) {
      invalidItems.push({
        section: 'referenceFormulas',
        index,
        reason: repaired.invalidReason,
        requiredField: 'equation'
      });
      return;
    }
    item.equation = repaired.equation;
    if (repaired.changed) {
      Object.assign(item, addNormalizationNote(item, repaired.note || 'Repaired formula equation text during quality checks.'));
    }
    item.title = makeFormulaTitle(item.equation, index);
    filtered.push(item);
    extractCompanionOhmsLawEquations(item, extraction).forEach((equation) => {
      additional.push(normalizeReferenceFormula({
        ...item,
        formulaId: makeGeneratedItemId('formula', [equation], additional.length + index, {}),
        equation,
        title: makeFormulaTitle(equation, index + additional.length),
        reviewStatus: 'pending',
        confidence: 'medium'
      }, makeSourceDefaults(extraction)));
    });
  });
  const deduped = [];
  const dedupedIndices = new Map();
  filtered.forEach((item) => {
    const key = normalizeFormulaEquation(item && item.equation);
    if (!key) {
      deduped.push(item);
      return;
    }
    if (!dedupedIndices.has(key)) {
      dedupedIndices.set(key, deduped.length);
      deduped.push(item);
      return;
    }
    const existingIndex = dedupedIndices.get(key);
    deduped[existingIndex] = preserveStricterReviewState(
      mergeSourceEvidence(item, deduped[existingIndex]),
      deduped[existingIndex]
    );
  });
  const seen = new Set(deduped.map((item) => normalizeFormulaEquation(item && item.equation)).filter(Boolean));
  additional.forEach((item) => {
    const key = normalizeFormulaEquation(item.equation);
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  pack.referenceFormulas = deduped;
  mergeQualityInvalidItemsIntoMetadata(pack, invalidItems);
}

function repairReferenceEquation(value, contextText = '', importProfile = 'general') {
  let equation = String(value || '').replace(/\s+/g, ' ').trim();
  const context = String(contextText || '').replace(/\s+/g, ' ').trim();
  if (!equation) return { equation: '', invalidReason: 'Missing equation text.' };
  equation = equation.replace(/^the reference formula is\s+/iu, '');
  equation = equation.replace(/^formula\s*[:\-]\s*/iu, '');
  equation = equation.replace(/\.\s*it can also be written as[\s\S]*$/iu, '').trim();
  equation = equation.replace(/[,:;]+$/u, '').trim();
  equation = normalizeVisibleMultiplicationMarker(equation);
  equation = cleanScienceExtractionArtifactText(equation, importProfile);
  if (looksCodeLikeEquation(equation)) {
    return { equation, invalidReason: 'Code-like expression was not accepted as a reference formula.' };
  }
  if (looksExtractionDamagedFormula(equation)) {
    return {
      equation,
      changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(equation),
      note: 'Formula text may be extraction-damaged; keep pending teacher review.'
    };
  }
  if (/^v\s*=\s*i$/iu.test(equation)) {
    if (/\bi\s*(?:x|\*|×)\s*r\b/iu.test(context)) {
      return { equation: 'V = I × R', changed: true, note: 'Repaired Ohm’s Law voltage equation from nearby source wording.' };
    }
    return { equation, invalidReason: 'Incomplete equation "V = I" was not accepted as a general reference formula.' };
  }
  if (/^displacement\s*=\s*final$/iu.test(equation)) {
    return { equation, invalidReason: 'Incomplete equation "displacement = final" was not accepted.' };
  }
  if (isWorkedExampleEquation(equation)) {
    return { equation, invalidReason: 'Worked-example numeric equation was not accepted as a general reference formula.' };
  }
  if (!/[A-Za-zµΩ]\s*(?:=|≈)\s*(?:[A-Za-z0-9µΩ]|\()/u.test(equation)) {
    return { equation, invalidReason: 'Equation was not a clean symbolic relationship.' };
  }
  const normalizedKnownEquation = normalizeKnownReferenceEquation(equation);
  if (normalizedKnownEquation) {
    return {
      equation: normalizedKnownEquation,
      changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(normalizedKnownEquation),
      note: 'Normalized known reference equation to standard teacher-facing notation.'
    };
  }
  if (!/[+\-*/×÷^/]/u.test(equation) && !looksImplicitSymbolicProduct(equation)) {
    return { equation, invalidReason: 'Equation looked incomplete and was not accepted.' };
  }
  return { equation, changed: normalizeFormulaEquation(value) !== normalizeFormulaEquation(equation) };
}

function normalizeKnownReferenceEquation(equation) {
  const canonical = normalizeFormulaEquationForTitle(equation);
  if (matchesEquationFamily(canonical, ['w=f*d', 'w=fd'])) return 'W = F × d';
  if (matchesEquationFamily(canonical, ['wave speed=frequency*wavelength', 'v=f*lambda', 'v=f*λ'])) return 'v = f × λ';
  if (matchesEquationFamily(canonical, ['pe=mgh', 'pe=m*g*h'])) return 'PE = m g h';
  if (matchesEquationFamily(canonical, ['ke=1/2mv^2', 'ke=0.5mv^2', 'ke=mv^2/2'])) return 'KE = 1/2 m v^2';
  if (matchesEquationFamily(canonical, ['p=w/t', 'p=w÷t'])) return 'P = W / t';
  if (matchesEquationFamily(canonical, ['density=mass/volume', 'd=m/v'])) return 'D = m / V';
  if (matchesEquationFamily(canonical, ['speed=distance/time'])) return 'speed = distance / time';
  if (matchesEquationFamily(canonical, ['velocity=displacement/time'])) return 'velocity = displacement / time';
  if (matchesEquationFamily(canonical, ['a=(vf-vi)/t'])) return 'a = (vf - vi) / t';
  if (matchesEquationFamily(canonical, ['fnet=m*a'])) return 'Fnet = m × a';
  return '';
}

function isWorkedExampleEquation(equation) {
  const text = String(equation || '').replace(/\s+/g, ' ').trim();
  if (!text || !/[=≈]/u.test(text)) return false;
  const equationSeparators = (text.match(/[=≈]/gu) || []).length;
  if (equationSeparators >= 2 && /\d/u.test(text)) return true;
  if (/\b(?:\d+(?:\.\d+)?\s*)?[A-Za-zµΩ°%]+\s+in\s+\d+(?:\.\d+)?\s*[A-Za-zµΩ°%]+\s*(?:=|≈)\s*\d+/u.test(text)) return true;
  if (/^\s*\d/u.test(text)) return true;
  if (/\b\d+(?:\.\d+)?\s*(?:ohms?|amps?|ampere|volts?|newtons?|n|j|w|v|a|m\/s(?:\^2)?|m|s)\b/iu.test(text) && /\b=\s*\d/u.test(text)) {
    return true;
  }
  return false;
}

function looksCodeLikeEquation(equation) {
  const text = String(equation || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/[{}[\];]/u.test(text)) return true;
  if (/=>|\b(?:const|let|var|function|return|class|import|export)\b/iu.test(text)) return true;
  if (/\b(?:console\.log|System\.out|printf|print\(|if\s*\(|for\s*\(|while\s*\()/iu.test(text)) return true;
  if (/^[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*new\s+[A-Za-z_$]/u.test(text)) return true;
  return false;
}

function extractCompanionOhmsLawEquations(item, extraction) {
  const evidence = [
    item && item.sourceTextSnippet,
    item && item.studentExplanation,
    extraction && extraction.text
  ].filter(nonEmptyString).join(' ');
  if (!/ohm|v\s*=\s*i|i\s*=\s*v\s*\/\s*r|r\s*=\s*v\s*\/\s*i/iu.test(evidence)) return [];
  const equations = [];
  if (/\bv\s*=\s*i\s*(?:x|\*|×)\s*r\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('V = I × R');
  if (/\bi\s*=\s*v\s*\/\s*r\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('I = V / R');
  if (/\br\s*=\s*v\s*\/\s*i\b/iu.test(evidence) || /\bohm'?s law\b/iu.test(evidence)) equations.push('R = V / I');
  return equations;
}

function mergeQualityInvalidItemsIntoMetadata(pack, invalidItems) {
  if (!Array.isArray(invalidItems) || !invalidItems.length) return;
  if (!pack.metadata || typeof pack.metadata !== 'object' || Array.isArray(pack.metadata)) pack.metadata = {};
  pack.metadata.invalidGeneratedItems = mergeInvalidGeneratedItems(pack.metadata.invalidGeneratedItems, invalidItems);
  pack.metadata.importWarnings = mergeImportWarnings(
    pack.metadata.importWarnings,
    invalidItems.map((entry) => formatInvalidGeneratedItemWarning(entry))
  );
}

function extractFormulaCandidates(extraction, sourceDefaults) {
  const sections = makeFormulaSourceSections(extraction, sourceDefaults);
  const candidates = [];
  sections.forEach((section) => {
    splitFormulaSearchText(section.text).forEach((line) => {
      splitLabeledFormulaLineCandidates(line).forEach((lineCandidate) => {
        extractEquationTextsFromLine(lineCandidate.searchLine).forEach((equation) => {
          candidates.push({
            equation,
            variables: extractFormulaVariables(equation, lineCandidate.searchLine),
            confidence: looksExtractionDamagedFormula(equation) || looksExtractionDamagedFormula(lineCandidate.searchLine) ? 'low' : 'medium',
            sourceFile: section.sourceFile,
            sourceLocation: section.sourceLocation,
            sourceTextSnippet: lineCandidate.sourceTextSnippet.slice(0, 240),
            sourceParse: lineCandidate.sourceParse
          });
        });
      });
    });
  });
  return mergeFormulaCandidates(candidates);
}

function makeFormulaSourceSections(extraction, sourceDefaults) {
  const sections = Array.isArray(extraction && extraction.sections) && extraction.sections.length
    ? extraction.sections
    : Array.isArray(extraction && extraction.pages) && extraction.pages.length
      ? extraction.pages.map((page, index) => ({
          label: `Page ${Number(page.pageNumber || page.number || index + 1)}`,
          sourceLocation: `Page ${Number(page.pageNumber || page.number || index + 1)}`,
          text: page.text || page.content || ''
        }))
      : [{ label: sourceDefaults.sourceLocation, sourceLocation: sourceDefaults.sourceLocation, text: extraction && extraction.text || '' }];
  return sections.map((section, index) => ({
    sourceFile: firstNonEmptyString(section.sourceFile, sourceDefaults.sourceFile),
    sourceLocation: firstNonEmptyString(section.sourceLocation, section.label, `Chunk ${index + 1}`, sourceDefaults.sourceLocation),
    text: String(section.text || section.content || '')
  }));
}

function splitFormulaSearchText(text) {
  return String(text || '')
    .split(/\n+|(?<=\.)\s+(?=(?:formula|equation|[A-Z][A-Za-z0-9_]{0,8}\s*=|\d?\s*[A-Za-zµΩ°%]+\s*=))/iu)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3 && line.length <= 500);
}

function isLabeledFormulaSourceLine(line) {
  return new RegExp(`^${FORMULA_LABEL_PATTERN}\\s*[:\\-]`, 'iu').test(String(line || '').trim());
}

function splitLabeledFormulaLineCandidates(line) {
  const cleaned = String(line || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const defaultCandidate = {
    searchLine: cleaned,
    sourceTextSnippet: cleaned,
    sourceParse: isLabeledFormulaSourceLine(cleaned) ? 'deterministic_labeled_formula_line' : 'deterministic_formula_line'
  };
  const labeledMatch = cleaned.match(new RegExp(`^(${FORMULA_LABEL_PATTERN})\\s*[:\\-]\\s*([\\s\\S]*)$`, 'iu'));
  if (!labeledMatch) return [defaultCandidate];
  const label = labeledMatch[1];
  const body = String(labeledMatch[2] || '').trim();
  if (!body || !/[=≈]/u.test(body) || !/[;,]/u.test(body)) return [defaultCandidate];
  const entries = body
    .split(/\s*[;,]\s*/u)
    .map((entry) => entry.trim())
    .filter((entry) => /[=≈]/u.test(entry));
  if (entries.length <= 1) return [defaultCandidate];
  return entries.map((entry) => ({
    searchLine: `${label}: ${entry}`,
    sourceTextSnippet: cleaned,
    sourceParse: 'deterministic_labeled_formula_line'
  }));
}

function extractEquationText(line) {
  const value = String(line || '').replace(/\s+/g, ' ').trim();
  if (!/[=≈]/u.test(value)) return '';
  let search = value.replace(/^[^:=≈]{0,80}:\s*(?=.*[=≈])/u, '');
  const formulaLead = search.match(/\b(?:formula|equation|relationship)\s*[:\-]?\s+([\s\S]+)$/iu);
  if (formulaLead) search = formulaLead[1].trim();
  const equationMatch = search.match(/(?:^|\b)([A-Za-zµΩ][A-Za-z0-9µΩ_./^() -]{0,32}\s*(?:=|≈)\s*[^.;\n]{1,140})/u)
    || search.match(/(\d?\s*[A-Za-zµΩ°%][A-Za-z0-9µΩ°%./^ -]{0,24}\s*(?:=|≈)\s*[^.;\n]{1,140})/u);
  if (!equationMatch) return '';
  let equation = equationMatch[1].trim();
  equation = equation.replace(/^(?:the\s+)?(?:formula|equation|relationship)\s+/iu, '');
  equation = equation.replace(/\s+\b(?:where|relates|when|if|because|for)\b[\s\S]*$/iu, '').trim();
  equation = equation.replace(/[,:]+$/u, '').trim();
  if (!/[A-Za-z0-9µΩ°%]\s*(?:=|≈)\s*[A-Za-z0-9µΩ°%]/u.test(equation)) return '';
  const hasOperator = /[+\-*/×÷^·]| per /iu.test(equation);
  if (!hasOperator && !looksImplicitSymbolicProduct(equation)) return '';
  return equation.slice(0, 160);
}

function looksImplicitSymbolicProduct(equation) {
  const rightSide = String(equation || '').split(/=|≈/u)[1] || '';
  const tokens = rightSide.match(/[A-Za-zµΩ]\w{0,3}/gu) || [];
  return tokens.length >= 2;
}

function extractEquationTextsFromLine(line) {
  const normalized = String(line || '').replace(/\s+/g, ' ').trim();
  const equations = [];
  const primary = extractEquationText(normalized);
  if (primary) equations.push(primary);
  const explicitPatterns = [
    /\bW\s*=\s*F\s*(?:(?:x|\*|×|\s)*)d\b/giu,
    /\bPE\s*=\s*m\s*(?:(?:x|\*|×|\s)*)g\s*(?:(?:x|\*|×|\s)*)h\b/giu,
    /\bKE\s*=\s*(?:1\s*\/\s*2|0\.5)\s*m\s*v(?:\s*\^\s*2|²)\b/giu,
    /\bP\s*=\s*W\s*(?:\/|÷)\s*t\b/giu,
    /\bspeed\s*=\s*distance\s*(?:\/|÷)\s*time\b/giu,
    /\bvelocity\s*=\s*displacement\s*(?:\/|÷)\s*time\b/giu,
    /\ba\s*=\s*\(\s*vf\s*-\s*vi\s*\)\s*(?:\/|÷)\s*t\b/giu,
    /\bFnet\s*=\s*m\s*(?:x|\*|×)\s*a\b/giu,
    /\bF\s*=\s*m\s*(?:x|\*|×|\s)\s*a\b/giu,
    /\bFf\s*=\s*(?:mu|µ)\s*(?:x|\*|×)\s*Fn\b/giu,
    /\bD\s*=\s*m\s*(?:\/|÷)\s*V\b/giu,
    /\bV\s*=\s*I\s*(?:x|\*|×)\s*R\b/giu,
    /\bI\s*=\s*V\s*\/\s*R\b/giu,
    /\bR\s*=\s*V\s*\/\s*I\b/giu
  ];
  explicitPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      equations.push(match[0].replace(/\bx\b/giu, '×').replace(/\s+/g, ' ').trim());
    }
  });
  return Array.from(new Set(equations.map((entry) => entry.trim()).filter(Boolean)));
}

function extractFormulaVariables(equation, sourceLine) {
  const symbols = Array.from(new Set(String(equation || '').match(/\b[A-Za-zµΩ]\w{0,3}\b/gu) || []));
  const variables = [];
  symbols.forEach((symbol) => {
    const meaning = extractVariableMeaning(symbol, sourceLine);
    if (meaning) {
      variables.push({ symbol, meaning });
    }
  });
  return variables;
}

function extractVariableMeaning(symbol, sourceLine) {
  const escaped = escapeRegExp(symbol);
  const patterns = [
    new RegExp(`\\b${escaped}\\b\\s+(?:is|means|represents)\\s+([^,;.()]{1,60})`, 'iu'),
    new RegExp(`\\b${escaped}\\b\\s*=\\s*([^,;.()]{1,60})`, 'iu')
  ];
  for (const pattern of patterns) {
    const match = String(sourceLine || '').match(pattern);
    if (match && match[1]) return match[1].replace(/\band\s*$/iu, '').trim();
  }
  return '';
}

function mergeFormulaCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  candidates.forEach((candidate) => {
    const key = normalizeFormulaEquation(candidate.equation);
    if (!key || seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });
  return unique;
}

function normalizeVisibleMultiplicationMarker(value) {
  return String(value || '')
    .replace(/[·]/gu, '×')
    .replace(/([A-Za-zµΩ0-9)\]])\s*x\s*(?=[A-WYZa-wyzµΩ0-9(])/gu, '$1 × ');
}

function normalizeCanonicalMultiplicationMarker(value) {
  return String(value || '')
    .replace(/[×·]/gu, '*')
    .replace(/([A-Za-zµΩ0-9)\]])\s*x\s*(?=[A-WYZa-wyzµΩ0-9(])/gu, '$1*');
}

function normalizeFormulaEquation(value) {
  return normalizeCanonicalMultiplicationMarker(String(value || ''))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function normalizeFormulaEquationForTitle(value) {
  return normalizeCanonicalMultiplicationMarker(String(value || ''))
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/delta/gu, 'd')
    .replace(/velocity/gu, 'v')
    .replace(/distance/gu, 'd')
    .replace(/changein/gu, 'd')
    .replace(/_/g, '')
    .trim();
}

function matchesEquationFamily(canonical, variants) {
  const value = String(canonical || '');
  return variants.some((variant) => value === normalizeFormulaEquationForTitle(variant));
}

function makeFormulaTitle(equation, index) {
  const canonical = normalizeFormulaEquationForTitle(equation);
  if (matchesEquationFamily(canonical, ['w=f*d', 'w=fd'])) return 'Work Formula';
  if (matchesEquationFamily(canonical, ['ke=1/2mv^2', 'ke=0.5mv^2', 'ke=mv^2/2'])) return 'Kinetic Energy Formula';
  if (matchesEquationFamily(canonical, ['pe=mgh', 'pe=m*g*h'])) return 'Potential Energy Formula';
  if (matchesEquationFamily(canonical, ['p=w/t', 'p=w÷t'])) return 'Power Formula';
  if (matchesEquationFamily(canonical, ['speed=distance/time', 'v=d/t'])) return 'Speed Formula';
  if (matchesEquationFamily(canonical, ['acceleration=changeinvelocity/time', 'a=dv/t', 'a=delta v/t'])) return 'Acceleration Formula';
  if (matchesEquationFamily(canonical, ['fnet=m*a', 'f_net=m*a', 'f=ma', 'f=m*a'])) return 'Net Force Formula';
  if (matchesEquationFamily(canonical, ['d=m/v', 'density=m/v'])) return 'Density Formula';
  if (matchesEquationFamily(canonical, ['v=i*r', 'v=ir'])) return 'Ohm’s Law Voltage Formula';
  if (matchesEquationFamily(canonical, ['i=v/r'])) return 'Ohm’s Law Current Formula';
  if (matchesEquationFamily(canonical, ['r=v/i'])) return 'Ohm’s Law Resistance Formula';
  if (matchesEquationFamily(canonical, ['p=i*v', 'p=iv'])) return 'Electrical Power Formula';
  const leftSide = String(equation || '').split(/=|≈/u)[0].replace(/[^A-Za-z0-9µΩ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return leftSide ? `${leftSide.slice(0, 48)} Formula` : `Reference Formula ${index + 1}`;
}

function looksExtractionDamagedFormula(value) {
  const text = String(value || '');
  if (!text) return false;
  if (/[�□■�]/u.test(text)) return true;
  if (/[=≈]\s*(?:$|[=≈])/u.test(text)) return true;
  if (/(?:[_-]\s*){3,}/u.test(text)) return true;
  if (/[^\p{L}\p{N}\s=≈+\-*/×÷^().,;:µΩ°%·_/]/u.test(text)) return true;
  return false;
}

function normalizeReviewFields(item) {
  const confidence = ['high', 'medium', 'low'].includes(item.confidence) ? item.confidence : 'low';
  return {
    ...item,
    reviewStatus: confidence === 'low' ? 'needs_review' : 'pending',
    confidence
  };
}

function normalizeSourceTracking(item, sourceDefaults) {
  const hadSourceEvidence = hasSourceEvidence(item);
  const sourceFile = normalizeItemSourceFile(item.sourceFile, sourceDefaults);
  const normalized = {
    ...item,
    sourceFile: sourceFile || sourceDefaults.sourceFile,
    sourceLocation: nonEmptyString(item.sourceLocation) ? item.sourceLocation : sourceDefaults.sourceLocation,
    sourceTextSnippet: nonEmptyString(item.sourceTextSnippet)
      ? item.sourceTextSnippet
      : nonEmptyString(item.sourceSnippet)
        ? item.sourceSnippet
        : sourceDefaults.sourceTextSnippet
  };
  if (!hadSourceEvidence) {
    return addNormalizationNote({
      ...normalized,
      confidence: 'low',
      reviewStatus: 'needs_review'
    }, 'Source evidence was filled from extraction defaults during import normalization; keep teacher review required.');
  }
  return normalized;
}

function normalizeItemSourceFile(sourceFile, sourceDefaults) {
  if (!nonEmptyString(sourceFile)) return '';
  const value = sourceFile.trim();
  const internalNames = [
    sourceDefaults && sourceDefaults.storedFileName,
    sourceDefaults && sourceDefaults.extractionJsonFileName
  ].filter(nonEmptyString).map(normalizeKey);
  if (sourceDefaults && nonEmptyString(sourceDefaults.sourceFile) && internalNames.includes(normalizeKey(value))) {
    return sourceDefaults.sourceFile;
  }
  return value;
}

function hasSourceEvidence(item) {
  return Boolean(
    nonEmptyString(item && item.sourceFile)
    || nonEmptyString(item && item.sourceLocation)
    || nonEmptyString(item && item.sourceTextSnippet)
    || nonEmptyString(item && item.sourceSnippet)
  );
}

function addNormalizationNote(item, note) {
  const notes = Array.isArray(item.normalizationNotes)
    ? item.normalizationNotes.slice()
    : nonEmptyString(item.normalizationNote)
      ? [item.normalizationNote]
      : [];
  if (!notes.includes(note)) notes.push(note);
  const existing = nonEmptyString(item.notes) ? item.notes : '';
  return {
    ...item,
    reviewStatus: 'needs_review',
    confidence: 'low',
    notes: existing && !existing.includes(note) ? `${existing} ${note}` : existing || note,
    normalizationNotes: notes
  };
}

function deriveShortTitle(candidates) {
  const text = firstDerivedText(candidates);
  if (!text) return '';
  const firstSentence = text.split(/(?<=[.!?])\s+/u)[0] || text;
  return firstSentence
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 8)
    .join(' ')
    .replace(/[.:;,]+$/u, '');
}

function cleanConceptTitle(value, options = {}) {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = stripLeadingSectionLabel(text, CONCEPT_LABEL_PATTERN);
  text = cleanScienceExtractionArtifactText(text);
  text = text.replace(/[.;:,]+$/u, '').trim();
  if (!text) return '';

  const normalized = normalizeItemKey(text);
  if (REJECTED_VOCAB_LABEL_KEYS.has(normalized)) return '';
  const preservedReadableTitles = {
    'energy changes in a falling object': 'Energy Changes in a Falling Object',
    'power and time': 'Power and Time',
    'distance is always positive': 'Distance Is Always Positive',
    'acceleration and changing velocity': 'Acceleration and Changing Velocity',
    'friction opposes motion': 'Friction Opposes Motion',
    'choosing the correct quantity': 'Choosing the Correct Quantity',
    'series circuits': 'Series Circuits',
    'electric charge interactions': 'Electric Charge Interactions',
    'ohm s law': 'Ohm’s Law',
    'plate movement': 'Plate Movement',
    'scientific evidence': 'Scientific Evidence',
    'rock cycle': 'Rock Cycle',
    'weather vs climate': 'Weather vs Climate',
    'earth s layers': 'Earth’s Layers',
    'plate tectonics': 'Plate Tectonics'
  };
  if (preservedReadableTitles[normalized]) return preservedReadableTitles[normalized];
  const combinedContext = [
    text,
    options.explanation,
    options.evidence
  ].filter(nonEmptyString).join(' ');
  if (/\bplates?\s+move\b|\bplate movement\b|\bplate movement causes\b|\bplates? move because\b/iu.test(combinedContext)) return 'Plate Movement';
  if (/\bscientific explanation\b.{0,80}\b(?:evidence|support)\b|\bmultiple types of evidence\b/iu.test(combinedContext)) return 'Scientific Evidence';
  if (/\brocks?\s+can\s+change\b|\brock cycle\b/iu.test(combinedContext)) return 'Rock Cycle';
  if (/\bearth'?s? layers?\b|\blayers?\s+are\s+identified\b/iu.test(combinedContext)) return 'Earth’s Layers';
  if (/\bweather\b.{0,80}\bclimate\b|\bclimate\b.{0,80}\bweather\b/iu.test(combinedContext)) return 'Weather vs Climate';
  if (/\bsunlight\b.{0,80}\bevaporation\b/iu.test(combinedContext)) return 'Evaporation';
  if (/\bcooling\b.{0,80}\bcondensation\b/iu.test(combinedContext)) return 'Condensation';
  if (/\bwater returns?\b.{0,80}\b(?:earth|precipitation|runoff|groundwater)\b/iu.test(combinedContext)) return 'Water Cycle';
  if (matchesConceptTitlePattern(normalized, ['falling', 'object', 'change'])) return 'Energy Changes in a Falling Object';
  if (matchesConceptTitlePattern(normalized, ['doing', 'same', 'work'])) return 'Power and Time';
  if (matchesConceptTitlePattern(normalized, ['distance', 'alway', 'positive']) || matchesConceptTitlePattern(normalized, ['distance', 'always', 'positive'])) {
    return 'Distance Is Always Positive';
  }
  if (matchesConceptTitlePattern(normalized, ['acceleration', 'happen', 'speed']) || matchesConceptTitlePattern(normalized, ['acceleration', 'happens', 'speed'])) {
    return 'Acceleration and Changing Velocity';
  }
  if (matchesConceptTitlePattern(normalized, ['friction', 'usually', 'act'])) return 'Friction Opposes Motion';
  if (matchesConceptTitlePattern(normalized, ['student', 'should', 'choose'])) return 'Choosing the Correct Quantity';
  if (matchesConceptTitlePattern(normalized, ['sery', 'circuit']) || matchesConceptTitlePattern(normalized, ['series', 'circuit'])) return 'Series Circuits';
  if (isLearningTargetSentence(text)) {
    const recovered = recoverLearningTargetConceptTitle(text, options);
    return recovered || '';
  }
  if (/\benergy\b/iu.test(text) && /\btransf(?:er|orm)/iu.test(text)) return 'Energy Transfer and Transformation';
  if (/\bspeed\b/iu.test(text) && /\bvelocity\b/iu.test(text)) return 'Speed Versus Velocity';
  if (/\b(gravitational potential energy|potential energy)\b/iu.test(text) && /\b(height|higher|above the ground)\b/iu.test(text)) {
    return 'Height and Gravitational Potential Energy';
  }
  if (/\belectric charge\b/iu.test(text)) return 'Electric Charge Interactions';
  if (/\bresultant\b/iu.test(text) && /\bforce\b/iu.test(text)) return 'Resultant Force';
  if (/\baverage\b/iu.test(text) && /\bspeed\b/iu.test(text)) return 'Average Speed';
  if (/\bsink\b/iu.test(text) && /\bfloat\b/iu.test(text)) return 'Sink and Float Behavior';
  if (/\bdisplacement\b/iu.test(text) && /\bvolume\b/iu.test(text)) return 'Water Displacement and Volume';

  const tokens = contentTokens(text);
  const sentenceLike = looksSentenceLikeConceptTitle(text);
  if (sentenceLike && tokens.length >= 2) {
    if (tokens.includes('balanced') && tokens.includes('force')) return 'Balanced Forces';
    if (tokens.includes('motion') && tokens.includes('force')) return 'Motion and Forces';
    return toTitleWords(tokens.slice(0, 3).join(' '));
  }
  return toTitleWords(text.split(/\s+/).slice(0, 8).join(' '));
}

function looksTruncatedGeneratedText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/[.!?]$/u.test(text)) return false;
  const words = text.split(/\s+/u).filter(Boolean);
  const last = words[words.length - 1] || '';
  if (/^(?:ri|ea|eart|suppor|convergen|transforma?)$/iu.test(last)) return true;
  if (last.length <= 2 && words.length >= 5) return true;
  if (/\b(?:and|or|to|of|in|as|with|because|including|support)\s*$/iu.test(text)) return true;
  return false;
}

function stripLikelyTruncatedTail(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!looksTruncatedGeneratedText(text)) return text;
  return text.replace(/\s+\S{1,4}$/u, '').replace(/\s+\b(?:and|or|to|of|in|as|with|because|including|support)\b$/iu, '').trim();
}

function recoverSourceSentenceForFragment(fragment, evidence) {
  const fragmentTokens = contentTokens(stripLikelyTruncatedTail(fragment));
  if (fragmentTokens.length < 2) return '';
  const sentences = sourceSentences(evidence);
  return sentences.find((sentence) => {
    const sentenceTokens = contentTokens(sentence);
    if (fragmentTokens.slice(0, 3).every((token) => sentenceTokens.includes(token))) return true;
    return orderedTokenPrefixMatches(fragmentTokens.slice(0, 4), sentenceTokens);
  }) || '';
}

function orderedTokenPrefixMatches(needles, haystack) {
  if (!needles.length || !haystack.length) return false;
  let cursor = 0;
  let matched = 0;
  needles.forEach((needle) => {
    const found = haystack.indexOf(needle, cursor);
    if (found >= 0) {
      matched += 1;
      cursor = found + 1;
    }
  });
  return matched >= Math.min(3, needles.length);
}

function sourceSentences(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|(?=\b[A-Z][a-z]+(?:\s+[a-z]+){0,4}\s+(?:is|are|can|often|changes?|move|moves?|returns?|drives?|causes?)\b)/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20 && sentence.length <= 280)
    .filter((sentence) => !looksSlideHeaderLine(sentence) && !isPageHeaderText(sentence) && !isReviewOrMetadataLine(sentence));
}

function isReviewOrMetadataConceptItem(item) {
  const text = [
    item && item.title,
    item && item.studentExplanation,
    item && item.sourceTextSnippet
  ].filter(nonEmptyString).join(' ');
  return isReviewOrMetadataLine(text)
    || /^earth science slide$/iu.test(String(item && item.title || '').trim())
    || /^review check$/iu.test(String(item && item.title || '').trim());
}

function isReviewOrMetadataLine(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/^review(?:\s+(?:check|items?))?$/iu.test(text)) return true;
  if (/^testing note\b|^expected behavior\b|^teacher import note\b|^purpose:\s*test\b/iu.test(text)) return true;
  if (/\bEarth_Science\s*\|\s*Slide\s+\d+\s+of\s+\d+\s*\|\s*Charlemagne\b/iu.test(text)) return true;
  if (/^Earth_Science\s*\|\s*Slide\b/iu.test(text)) return true;
  if (/^Charlemagne .* import stress test$/iu.test(text)) return true;
  if (/^Extract\s+[\w\s,/-]+(?:\.|$)/iu.test(text)) return true;
  if (/^Do not create formula code\.?$/iu.test(text)) return true;
  if (/^Look for categories such as\b/iu.test(text)) return true;
  return false;
}

function looksSentenceLikeConceptTitle(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[.!?;]/u.test(text)) return true;
  if (text.split(/\s+/).length > 6) return true;
  return /\b(is|are|can|should|must|has|have|do|does|did|change|changes|using|because|when|if|while|explain|describe)\b/iu.test(text);
}

function isLearningTargetSentence(value) {
  return /^\s*students?\s+(?:should|will|can|must)\s+(?:explain|describe|identify|analyze|model|compare)\b/iu.test(String(value || ''));
}

function recoverLearningTargetConceptTitle(value, options = {}) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const verbObject = text.match(/\b(?:explain|describe|identify|analyze|model|compare)\s+(.+?)(?:\s+(?:using|with|by|from|based on|in)\b|[.;]|$)/iu);
  const candidate = firstNonEmptyString(verbObject && verbObject[1], options.explanation, options.evidence);
  if (!candidate) return '';
  if (/\belectric charge\b/iu.test(candidate)) return 'Electric Charge Interactions';
  if (/\bohm'?s?\s+law\b|\bvoltage\b.*\bcurrent\b.*\bresistance\b|\bcurrent\b.*\bvoltage\b.*\bresistance\b/iu.test(candidate)) return 'Ohm’s Law';
  if (/\bseries circuit\b/iu.test(candidate)) return 'Series Circuits';
  if (/\bchoose\b.{0,40}\b(?:quantity|variable|formula)\b/iu.test(candidate)) return 'Choosing the Correct Quantity';
  if (/\baverage\b/iu.test(candidate) && /\bspeed\b/iu.test(candidate)) return 'Average Speed';
  if (/\bresultant\b/iu.test(candidate) && /\bforce\b/iu.test(candidate)) return 'Resultant Force';
  const tokens = contentTokens(candidate);
  if (tokens.length < 2) return '';
  return toTitleWords(tokens.slice(0, 4).join(' '));
}

function matchesConceptTitlePattern(normalizedTitle, requiredTokens) {
  const tokens = new Set(String(normalizedTitle || '').split(' ').filter(Boolean));
  return requiredTokens.every((token) => tokens.has(token));
}

function toTitleWords(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .slice(0, 80)
    .trim();
}

function firstDerivedText(candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const nested = firstDerivedText(candidate);
      if (nested) return nested;
      continue;
    }
    if (nonEmptyString(candidate)) return sanitizeModelString(candidate);
  }
  return '';
}

function makeGeneratedItemId(prefix, candidates, index = 0, sourceDefaults = {}) {
  const text = firstDerivedText(candidates);
  const slug = slugify(text);
  if (slug) return `${prefix}-${slug}`;
  const page = inferPageFromLocation(sourceDefaults.sourceLocation);
  return `${prefix}${page ? `-page-${page}` : ''}-${String(index + 1).padStart(3, '0')}`;
}

function toDisplayLabelFromId(value) {
  if (!nonEmptyString(value)) return '';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function conceptIdTitleCandidate(value) {
  if (!nonEmptyString(value)) return '';
  const normalized = String(value || '').trim().toLowerCase();
  if (/^concept(?:-page-\d+)?-\d{3,}$/u.test(normalized)) return '';
  return toDisplayLabelFromId(value);
}

function deriveEquationText(item = {}) {
  const direct = firstNonEmptyString(
    item.equation,
    item.formula,
    item.expression,
    item.formulaText,
    item.math,
    item.latex
  );
  if (direct) return direct;
  const snippet = firstNonEmptyString(item.sourceTextSnippet, item.sourceSnippet, item.studentExplanation, item.notes);
  if (!snippet) return '';
  const inline = snippet.match(/[A-Za-z][^=]{0,24}=\s*[A-Za-z0-9().+\-*/×÷^_ ]+/u);
  return inline ? inline[0].trim() : '';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

function inferPageFromLocation(value) {
  const match = String(value || '').match(/\bpage\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

function buildImportNormalizationReport(pack) {
  const report = {
    conceptIdsGenerated: 0,
    conceptTitlesGenerated: 0,
    vocabularyIdsGenerated: 0,
    vocabularyTermsGenerated: 0,
    problemIdsGenerated: 0,
    smokeTestIdsGenerated: 0,
    standardsMapIdsMapped: 0,
    sourceEvidenceFilled: 0,
    reviewNeededItems: 0,
    droppedItems: 0,
    totalNormalized: 0,
    notes: []
  };
  [
    ['vocabulary', pack.vocabulary],
    ['concepts', pack.concepts],
    ['problemBank', pack.problemBank],
    ['standardsMap', pack.standardsMap],
    ['smokeTests', pack.smokeTests]
  ].forEach(([sectionName, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const notes = Array.isArray(item.normalizationNotes) ? item.normalizationNotes : [];
      if (notes.length > 0) report.reviewNeededItems += 1;
      notes.forEach((note) => {
        incrementNormalizationReport(report, sectionName, note);
      });
    });
  });
  report.totalNormalized = report.conceptIdsGenerated
    + report.conceptTitlesGenerated
    + report.vocabularyIdsGenerated
    + report.vocabularyTermsGenerated
    + report.problemIdsGenerated
    + report.smokeTestIdsGenerated
    + report.standardsMapIdsMapped
    + report.sourceEvidenceFilled;
  report.droppedItems = Array.isArray(pack && pack.metadata && pack.metadata.invalidGeneratedItems)
    ? pack.metadata.invalidGeneratedItems.length
    : 0;
  return report;
}

function mergeInvalidGeneratedItems(existing, additions) {
  const merged = [];
  [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(additions) ? additions : [])]
    .forEach((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
      const normalized = {
        section: firstNonEmptyString(entry.section),
        index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : -1,
        requiredField: firstNonEmptyString(entry.requiredField),
        reason: firstNonEmptyString(entry.reason)
      };
      if (!normalized.section || normalized.index < 0 || !normalized.reason) return;
      const key = `${normalized.section}:${normalized.index}:${normalized.reason}`;
      if (!merged.some((item) => `${item.section}:${item.index}:${item.reason}` === key)) {
        merged.push(normalized);
      }
    });
  return merged;
}

function mergeImportWarnings(existing, additions) {
  return Array.from(new Set([
    ...(Array.isArray(existing) ? existing.filter(nonEmptyString) : []),
    ...(Array.isArray(additions) ? additions.filter(nonEmptyString) : [])
  ]));
}

function formatInvalidGeneratedItemWarning(entry = {}) {
  const section = firstNonEmptyString(entry.section, 'unknown');
  const index = Number.isFinite(Number(entry.index)) ? Number(entry.index) : 0;
  const reason = firstNonEmptyString(entry.reason, 'Invalid generated item.');
  return `Removed invalid generated item ${section}[${index}]: ${reason}`;
}

function isMissingDraftWordingValue(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return !text || /draft wording not available/i.test(text) || /^missing$/i.test(text);
}

function hasQuarantineMarker(item) {
  const flags = [
    item && item.quarantineStatus,
    item && item.warningStatus,
    item && item.validationStatus,
    item && item.repairStatus
  ].filter(nonEmptyString).join(' ').toLowerCase();
  return /\bquarantine|quarantined\b/.test(flags);
}

function isVocabularySectionLabel(value) {
  return REJECTED_VOCAB_LABEL_KEYS.has(normalizeItemKey(value));
}

function recoverVocabularyDefinitionText(item, evidenceText, extraction) {
  const evidenceRaw = String(evidenceText || '');
  const evidence = evidenceRaw.replace(/\s+/g, ' ').trim();
  if (!evidence) return '';
  const term = firstNonEmptyString(item && item.term, item && item.title);
  if (!nonEmptyString(term)) return '';
  const lineDefinition = recoverTermColonDefinition(term, item, extraction, evidenceRaw);
  if (lineDefinition) return lineDefinition;
  const flexibleTerm = contentTokens(term).map(escapeRegExp).join('\\s+');
  if (!flexibleTerm) return '';
  const patterns = [
    new RegExp(`\\b${flexibleTerm}\\b[^.!?]{0,140}\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b[^.!?]{1,180}`, 'iu'),
    new RegExp(`\\b${flexibleTerm}\\b\\s*[:\\-]\\s*[^.!?]{4,180}`, 'iu')
  ];
  for (const pattern of patterns) {
    const match = evidence.match(pattern);
    if (!match || !match[0]) continue;
    const normalized = normalizeRecoveredDefinitionText(match[0], term);
    if (normalized) return normalized;
  }
  const sentence = evidence
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .find((part) => phraseAppearsInText(term, part) && part.length >= 15 && !looksSlideHeaderLine(part));
  return normalizeRecoveredDefinitionText(sentence || '', term);
}

function recoverTermColonDefinition(term, item, extraction, evidenceText) {
  const termKey = canonicalVocabularyKey(term);
  if (!termKey) return '';
  const lines = [];
  const matchingSections = findMatchingExtractionSections(item, extraction);
  matchingSections.forEach((section) => {
    String(section && section.text || '')
      .split(/\n+/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  });
  String(evidenceText || '')
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => lines.push(line));
  for (const line of lines) {
    if (!/:/.test(line)) continue;
    if (looksSlideHeaderLine(line)) continue;
    const match = line.match(/^[•*\-\d.)\s]*([^:]{1,80})\s*:\s*(.+)$/u);
    if (!match) continue;
    const labelKey = canonicalVocabularyKey(match[1]);
    if (!labelKey || labelKey !== termKey) continue;
    const definition = normalizeRecoveredDefinitionText(match[2], term);
    if (definition) return definition;
  }
  return '';
}

function normalizeRecoveredDefinitionText(value, term = '') {
  let text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  text = text.replace(/^[•*\-\d.)\s]+/u, '').trim();
  const termPattern = term ? new RegExp(`^${escapeRegExp(String(term).trim())}\\s*[:\\-]\\s*`, 'iu') : null;
  if (termPattern) text = text.replace(termPattern, '').trim();
  if (!text || looksSlideHeaderLine(text)) return '';
  const firstSentence = text.split(/(?<=[.!?])\s+/u).find((sentence) => {
    const clean = String(sentence || '').trim();
    return clean.length >= 12 && !looksSlideHeaderLine(clean);
  }) || text;
  const cleanSentence = firstSentence.replace(/[.;:,]+$/u, '').trim();
  if (!cleanSentence) return '';
  if (cleanSentence.length <= 220) return cleanSentence;
  return cleanSentence.slice(0, 220).replace(/\s+\S*$/u, '').replace(/[.;:,]+$/u, '').trim();
}

function incrementNormalizationReport(report, sectionName, note) {
  if (!report.notes.includes(note)) report.notes.push(note);
  if (sectionName === 'concepts' && note.includes('concept ID')) report.conceptIdsGenerated += 1;
  if (sectionName === 'concepts' && note.includes('concept title')) report.conceptTitlesGenerated += 1;
  if (sectionName === 'vocabulary' && note.includes('vocabulary ID')) report.vocabularyIdsGenerated += 1;
  if (sectionName === 'vocabulary' && note.includes('vocabulary term')) report.vocabularyTermsGenerated += 1;
  if (sectionName === 'problemBank' && note.includes('problem ID')) report.problemIdsGenerated += 1;
  if (sectionName === 'smokeTests' && note.includes('smoke test ID')) report.smokeTestIdsGenerated += 1;
  if (sectionName === 'standardsMap' && note.includes('standardsMap ID')) report.standardsMapIdsMapped += 1;
  if (note.includes('Source evidence was filled')) report.sourceEvidenceFilled += 1;
}

function makeSourceDefaults(extraction) {
  const metadata = extraction && extraction.metadata && typeof extraction.metadata === 'object'
    ? extraction.metadata
    : {};
  const upload = extraction && extraction.upload && typeof extraction.upload === 'object'
    ? extraction.upload
    : {};
  const sourceFile = firstNonEmptyString(
    upload.originalFileName,
    extraction && extraction.fileName,
    metadata.fileName,
    extraction && extraction.filePath ? path.basename(extraction.filePath) : ''
  );

  return {
    sourceFile,
    uploadId: firstNonEmptyString(upload.uploadId),
    storedFileName: firstNonEmptyString(upload.storedFileName),
    extractionJsonFileName: firstNonEmptyString(upload.extractionJsonFileName),
    fileType: firstNonEmptyString(
      extraction && extraction.extension ? String(extraction.extension).replace(/^\./, '') : '',
      extraction && extraction.mimeGuess,
      metadata.detectedType,
      'unknown'
    ),
    subject: firstNonEmptyString(metadata.subject, extraction && extraction.subject),
    importProfile: normalizeImportProfile(metadata.importProfile || extraction && extraction.importProfile),
    gradeLevel: firstNonEmptyString(metadata.gradeLevel, extraction && extraction.gradeLevel),
    characterCount: String(extraction && extraction.text || '').length,
    pageCount: Number(metadata.pageCount || 0),
    chunkCount: Array.isArray(extraction && extraction.sections) ? extraction.sections.length : 0,
    sourceLocation: metadata.importSelection && metadata.importSelection.label
      ? metadata.importSelection.label
      : 'extracted text',
    sourceTextSnippet: makeSourceTextSnippet(extraction && extraction.text)
  };
}

function buildSafeDraftMetadata(modelMetadata, { extraction, packName, packId, sourceDefaults, importProfile, importScope }) {
  const uncertainSections = Array.isArray(modelMetadata && modelMetadata.importUncertainSections)
    ? modelMetadata.importUncertainSections
      .map((entry) => ({
        sourceLocation: String(entry && entry.sourceLocation || '').trim().slice(0, 240),
        note: String(entry && entry.note || '').trim().slice(0, 500)
      }))
      .filter((entry) => entry.sourceLocation || entry.note)
    : [];
  return {
    modelMetadata: sanitizeModelMetadata(modelMetadata),
    createdBy: 'charlemagne-teacher-content-import',
    createdAt: firstNonEmptyString(modelMetadata && modelMetadata.createdAt, new Date().toISOString()),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    reviewStatus: 'pending',
    packName,
    packId,
    sourceUpload: {
      uploadId: sourceDefaults.uploadId,
      originalFileName: sourceDefaults.sourceFile,
      storedFileName: sourceDefaults.storedFileName,
      extractionJsonFileName: sourceDefaults.extractionJsonFileName,
      importProfile: normalizeImportProfile(importProfile || sourceDefaults.importProfile),
      fileType: sourceDefaults.fileType,
      characterCount: sourceDefaults.characterCount,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount
    },
    extraction: {
      characterCount: String(extraction && extraction.text || '').length,
      pageCount: sourceDefaults.pageCount,
      chunkCount: sourceDefaults.chunkCount
    },
    importProfile: normalizeImportProfile(importProfile || sourceDefaults.importProfile),
    importScope: importScope || undefined,
    importUncertainSections: uncertainSections
  };
}

function normalizeImportProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if ([
    'general',
    'physical_science',
    'biology',
    'chemistry',
    'earth_space_science',
    'math',
    'english_reading',
    'history_social_studies',
    'art',
    'computer_science',
    'robotics',
    'procedures_class_info'
  ].includes(raw)) return raw;
  return 'general';
}

function cleanScienceExtractionArtifactText(value, importProfile = 'general') {
  let text = String(value || '');
  text = text.replace(/^\s*l\s+(?=[A-Za-z])/u, '');
  if (normalizeImportProfile(importProfile) !== 'physical_science') return text;
  return text
    .replace(/\bwavelengt\b/giu, 'wavelength')
    .replace(/\bfrequncy\b/giu, 'frequency')
    .replace(/\btemperture\b/giu, 'temperature')
    .replace(/\baccleration\b/giu, 'acceleration');
}

function isInvalidPhysicalScienceConceptTitle(value) {
  const title = normalizeItemKey(value);
  if (!title) return true;
  const blockedExact = new Set([
    'physical science slide',
    'good answer should',
    'key units',
    'machine have high',
    'more speed mean',
    'cold doe flow'
  ]);
  if (blockedExact.has(title)) return true;
  if (/^(?:page|slide|section|chapter)\b/iu.test(title)) return true;
  if (/^(?:key|good|more|cold|machine)\b/iu.test(title) && title.split(' ').length <= 4) return true;
  if (title.split(' ').length < 2) return true;
  return false;
}

function sanitizeModelMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const safe = {};
  ['notes', 'model', 'promptVersion', 'createdBy'].forEach((field) => {
    if (nonEmptyString(metadata[field])) safe[field] = metadata[field].trim().slice(0, 500);
  });
  return safe;
}

function makeDraftPackId({ packName, extraction, fallbackPackId }) {
  const upload = extraction && extraction.upload && typeof extraction.upload === 'object' ? extraction.upload : {};
  const base = slugify(packName || titleFromPackId(fallbackPackId) || 'teacher-upload');
  const suffix = slugify(firstNonEmptyString(upload.uploadId, extraction && extraction.uploadId));
  const candidate = suffix ? `draft-${base}-${suffix}` : (packName ? `draft-${base}` : fallbackPackId);
  const safeCandidate = slugify(candidate || `draft-${base}`);
  return safeCandidate || 'draft-teacher-upload';
}

function titleFromPackId(packId) {
  return String(packId || '')
    .replace(/^draft[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function slugify(value) {
  const slug = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return SAFE_PACK_ID_PATTERN.test(slug) ? slug : '';
}

function sanitizeModelString(value) {
  return nonEmptyString(value) ? value.trim().slice(0, 120) : '';
}

function countGeneratedItems(pack) {
  const counts = {};
  GENERATED_ITEM_SECTIONS.forEach((sectionName) => {
    if (sectionName === 'sourceFiles') return;
    counts[sectionName] = Array.isArray(pack && pack[sectionName]) ? pack[sectionName].length : 0;
  });
  return counts;
}

function hasAnyReviewableGeneratedItems(pack) {
  const counts = countGeneratedItems(pack);
  return Object.values(counts).some((value) => Number(value || 0) > 0);
}

function buildInvalidGeneratedItemTechnicalErrors(invalidItems = []) {
  const details = [];
  (Array.isArray(invalidItems) ? invalidItems : []).forEach((entry) => {
    const section = firstNonEmptyString(entry && entry.section, 'unknown');
    const index = Number.isFinite(Number(entry && entry.index)) ? Number(entry.index) : -1;
    const reason = firstNonEmptyString(entry && entry.reason, 'Invalid generated item.');
    if (index >= 0) {
      details.push(`Removed ${section}[${index}] during draft salvage: ${reason}`);
    } else {
      details.push(`Removed ${section} item during draft salvage: ${reason}`);
    }
  });
  return details;
}

function makeProgressRecorder(timeline, onProgress) {
  return (type, message, details = {}) => {
    const event = {
      type,
      message,
      at: new Date().toISOString(),
      details: sanitizeProgressDetails(details)
    };
    timeline.push(event);
    if (typeof onProgress === 'function') onProgress(event);
    return event;
  };
}

function sanitizeProgressDetails(details) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const safe = {};
  Object.entries(details).forEach(([key, value]) => {
    if (value === undefined || typeof value === 'function') return;
    if (Array.isArray(value)) {
      safe[key] = value.map((item) => typeof item === 'string' ? item.slice(0, 500) : item);
      return;
    }
    if (value && typeof value === 'object') {
      safe[key] = sanitizeProgressDetails(value);
      return;
    }
    safe[key] = typeof value === 'string' ? value.slice(0, 500) : value;
  });
  return safe;
}

function firstError(errors, fallback) {
  return Array.isArray(errors) && errors.length ? String(errors[0]) : fallback;
}

function normalizedSourceFileNames(pack) {
  return Array.from(new Set(
    (Array.isArray(pack && pack.sourceFiles) ? pack.sourceFiles : [])
      .map((item) => item && item.fileName)
      .filter(nonEmptyString)
  ));
}

function makeSourceTextSnippet(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Extracted text was used for this draft item.';
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}


module.exports = {
  mergeDraftKnowledgePacks,
  mergeUniqueObjects,
  mergeConceptItems,
  mergeVocabularyItems,
  normalizeKey,
  normalizeItemKey,
  canonicalVocabularyKey,
  singularizeSimpleWord,
  normalizeDraftKnowledgePack,
  normalizeCompactModelOutput,
  collectUnsupportedTopLevelModelArrays,
  normalizeSourceFiles,
  normalizeVocabularyItem,
  normalizeConceptItem,
  normalizeReferenceFormula,
  salvageGeneratedItemSections,
  normalizeProblemItem,
  normalizeStandardsMapItem,
  normalizeSmokeTest,
  dedupeDraftItems,
  normalizeTermAliases,
  normalizeAliasList,
  addSourceDerivedVocabulary,
  addSourceDerivedReferenceFormulas,
  addSourceDerivedConcepts,
  recoverConceptExplanationsFromSource,
  recoverVocabularyDefinitionsFromSource,
  cleanupConceptTitles,
  applyVocabularyQualityGates,
  applyFormulaQualityGates,
  buildImportNormalizationReport,
  mergeInvalidGeneratedItems,
  mergeImportWarnings,
  makeSourceDefaults,
  buildSafeDraftMetadata,
  normalizeImportProfile,
  cleanScienceExtractionArtifactText,
  sanitizeModelMetadata,
  makeDraftPackId,
  titleFromPackId,
  sanitizeModelString,
  countGeneratedItems,
  hasAnyReviewableGeneratedItems,
  buildInvalidGeneratedItemTechnicalErrors,
  makeProgressRecorder,
  sanitizeProgressDetails,
  firstError,
  normalizedSourceFileNames,
  makeSourceTextSnippet
};
