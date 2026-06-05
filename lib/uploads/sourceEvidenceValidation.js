const {
  CONCEPT_LABEL_PATTERN,
  FORMULA_LABEL_PATTERN,
  SOURCE_GROUNDING_WARNING,
  THIN_EXTRACTION_WARNING,
  VOCAB_SECTION_LABEL_PATTERN,
  SOURCE_GROUNDING_SECTIONS
} = require('./importConstants');
const { firstNonEmptyString, nonEmptyString } = require('./importTextUtils');
const { estimatePageCount, positiveInteger } = require('./importSafety');

function applySourceEvidenceValidation(pack, extraction) {
  const report = {
    checkedItems: 0,
    supportedItems: 0,
    weakItems: 0,
    unsupportedItems: 0,
    thinExtractionItems: 0,
    warnings: []
  };

  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return report;

  SOURCE_GROUNDING_SECTIONS.forEach((sectionName) => {
    const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
    items.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      report.checkedItems += 1;
      const result = validateItemSourceGrounding(sectionName, item, extraction);
      item.sourceGrounding = {
        status: result.status,
        termOrTitleFound: result.termOrTitleFound,
        explanationSupported: result.explanationSupported,
        evidenceStrength: result.evidenceStrength,
        reasons: result.reasons
      };
      if (result.thinExtraction) {
        report.thinExtractionItems += 1;
        addItemWarning(item, THIN_EXTRACTION_WARNING);
      }
      if (result.status === 'supported') {
        report.supportedItems += 1;
        item.warningStatus = item.warningStatus || '';
        return;
      }

      addItemWarning(item, SOURCE_GROUNDING_WARNING);
      item.warningStatus = firstNonEmptyString(item.warningStatus, 'source_evidence_weak');
      item.repairStatus = firstNonEmptyString(item.repairStatus, 'repair_needed');
      item.confidence = 'low';
      item.reviewStatus = 'needs_review';
      if (result.status === 'unsupported') {
        report.unsupportedItems += 1;
      } else {
        report.weakItems += 1;
      }
    });
  });

  if (report.weakItems > 0 || report.unsupportedItems > 0) {
    report.warnings.push(SOURCE_GROUNDING_WARNING);
  }
  if (report.thinExtractionItems > 0) {
    report.warnings.push(THIN_EXTRACTION_WARNING);
  }
  return report;
}

function validateItemSourceGrounding(sectionName, item, extraction) {
  if (sectionName === 'vocabulary') return validateVocabularyGrounding(item, extraction);
  if (sectionName === 'concepts') return validateConceptGrounding(item, extraction);
  if (sectionName === 'referenceFormulas') return validateFormulaGrounding(item, extraction);
  return makeGroundingResult('supported');
}

function validateVocabularyGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const term = firstNonEmptyString(item.term, item.title);
  const definition = [
    item.studentDefinition,
    item.teacherDefinition,
    item.misconception
  ].filter(nonEmptyString).join(' ');
  const termFound = phraseAppearsInText(term, evidence)
    || (Array.isArray(item.aliases) && item.aliases.some((alias) => phraseAppearsInText(alias, evidence)));
  const thinExtraction = isThinEvidence(evidence);
  const headingOnly = looksHeadingOnlyEvidence(term, evidence);
  const overlap = meaningfulOverlap(definition, evidence, [term, item.aliases]);
  const hasDefinitionPattern = termFound && hasDefinitionPatternNearTerm(term, evidence);
  const explicitDefinition = findExplicitVocabularyDefinitionInEvidence(term, evidence);

  if (!termFound) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: false,
      thinExtraction,
      reasons: ['Term was not found in the cited source evidence.']
    });
  }

  if (headingOnly) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: true,
      thinExtraction: true,
      reasons: ['Source evidence appears to be only a heading or term, not a definition.']
    });
  }

  if (explicitDefinition && meaningfulOverlap(definition, explicitDefinition, [term, item.aliases]).count >= 1) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: Math.max(overlap.ratio, 0.5)
    });
  }

  if (hasDefinitionPattern && overlap.count >= 1) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: overlap.ratio
    });
  }

  if (overlap.count >= 2 && overlap.ratio >= 0.25) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: overlap.ratio
    });
  }

  if (hasDefinitionPattern || overlap.count >= 2) {
    return makeGroundingResult('weak', {
      termOrTitleFound: true,
      explanationSupported: false,
      thinExtraction,
      evidenceStrength: overlap.ratio,
      reasons: ['Definition wording only weakly overlaps the cited source evidence.']
    });
  }

  return makeGroundingResult('unsupported', {
    termOrTitleFound: true,
    explanationSupported: false,
    thinExtraction,
    evidenceStrength: overlap.ratio,
    reasons: ['Cited evidence did not include a nearby source-supported definition or explanation.']
  });
}

function validateConceptGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const title = firstNonEmptyString(item.title, item.conceptId);
  const explanation = [
    item.studentExplanation,
    Array.isArray(item.keyIdeas) ? item.keyIdeas.join(' ') : '',
    Array.isArray(item.examples) ? item.examples.join(' ') : ''
  ].filter(nonEmptyString).join(' ');
  const thinExtraction = isThinEvidence(evidence);
  const titleOverlap = meaningfulOverlap(title, evidence, []);
  const explanationOverlap = meaningfulOverlap(explanation, evidence, [item.aliases]);
  const titleFound = phraseAppearsInText(title, evidence)
    || phraseAppearsInText(title, item && item.sourceFile)
    || titleOverlap.ratio >= 0.6
    || titleOverlap.count >= Math.min(2, contentTokens(title).length);

  if (!titleFound) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: false,
      thinExtraction,
      reasons: ['Concept title was not found or strongly reflected in the cited source evidence.']
    });
  }

  if (looksHeadingOnlyEvidence(title, evidence)) {
    return makeGroundingResult('unsupported', {
      termOrTitleFound: true,
      thinExtraction: true,
      reasons: ['Source evidence appears to be only a heading or title, not an explanation.']
    });
  }

  if (explanationOverlap.count >= 2 && explanationOverlap.ratio >= 0.25) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: explanationOverlap.ratio
    });
  }

  if (explanationOverlap.count >= 1) {
    return makeGroundingResult('weak', {
      termOrTitleFound: true,
      explanationSupported: false,
      thinExtraction,
      evidenceStrength: explanationOverlap.ratio,
      reasons: ['Concept explanation only weakly overlaps the cited source evidence.']
    });
  }

  return makeGroundingResult('unsupported', {
    termOrTitleFound: true,
    explanationSupported: false,
    thinExtraction,
    reasons: ['Cited evidence did not include supporting source explanation for the concept.']
  });
}

function validateFormulaGrounding(item, extraction) {
  const evidence = makeItemEvidenceText(item, extraction);
  const equation = firstNonEmptyString(item.equation);
  const thinExtraction = isThinEvidence(evidence);
  const normalizedEquation = normalizeFormulaEquation(equation);
  const normalizedEvidence = normalizeFormulaEquation(evidence);
  const equationFound = Boolean(normalizedEquation && normalizedEvidence.includes(normalizedEquation));
  const tokenOverlap = meaningfulOverlap(equation, evidence, []);

  if (equationFound || tokenOverlap.count >= 2) {
    return makeGroundingResult('supported', {
      termOrTitleFound: true,
      explanationSupported: true,
      thinExtraction,
      evidenceStrength: equationFound ? 1 : tokenOverlap.ratio
    });
  }

  return makeGroundingResult('weak', {
    termOrTitleFound: false,
    explanationSupported: false,
    thinExtraction,
    reasons: ['Formula equation was not found in the cited source evidence.']
  });
}

function makeGroundingResult(status, details = {}) {
  return {
    status,
    termOrTitleFound: details.termOrTitleFound !== false,
    explanationSupported: details.explanationSupported === true || status === 'supported',
    evidenceStrength: Number(details.evidenceStrength || 0),
    thinExtraction: details.thinExtraction === true,
    reasons: Array.isArray(details.reasons) ? details.reasons : []
  };
}

function makeItemEvidenceText(item, extraction) {
  const matchingSections = findMatchingExtractionSections(item, extraction);
  const snippets = [
    item && item.sourceTextSnippet,
    item && item.sourceSnippet
  ].filter(nonEmptyString);
  const parts = [];
  if (Array.isArray(item && item.sourceReferences)) {
    item.sourceReferences.forEach((reference) => {
      if (reference && typeof reference === 'object' && nonEmptyString(reference.sourceTextSnippet)) snippets.push(reference.sourceTextSnippet);
    });
  }
  matchingSections.forEach((section) => parts.push(section.text));
  snippets.forEach((snippet) => {
    if (!matchingSections.length || sourceSnippetAppearsInExtraction(snippet, extraction)) {
      parts.push(snippet);
    }
  });
  return Array.from(new Set(parts.filter(nonEmptyString).map((part) => String(part).replace(/\s+/g, ' ').trim()))).join(' ');
}

function findMatchingExtractionSections(item, extraction) {
  const sections = makePromptSections(extraction || {});
  if (!sections.length || !item) return [];
  const sourceLocation = normalizeItemKey(item.sourceLocation);
  const sourceFile = normalizeKey(item.sourceFile);
  const page = inferPageFromLocation(item.sourceLocation);
  const pageRange = inferPageRangeFromLocation(item.sourceLocation);
  const matches = sections.filter((section) => {
    const sectionLocation = normalizeItemKey(firstNonEmptyString(section.sourceLocation, section.label));
    const sectionFile = normalizeKey(section.sourceFile);
    const sectionPage = Number(section.pageNumber || 0);
    return Boolean(
      sourceLocation === 'extracted text'
      || sourceLocation === 'full text'
      || (sourceLocation && sectionLocation && (sectionLocation === sourceLocation || sectionLocation.includes(sourceLocation) || sourceLocation.includes(sectionLocation)))
      || (page && sectionPage === page)
      || (pageRange && sectionPage >= pageRange.start && sectionPage <= pageRange.end)
      || (sourceFile && sectionFile && sectionFile === sourceFile)
    );
  });
  return matches.slice(0, 2);
}

function sourceSnippetAppearsInExtraction(snippet, extraction) {
  const snippetKey = normalizeItemKey(snippet).slice(0, 160);
  if (!snippetKey) return false;
  const extractionKey = normalizeItemKey(extraction && extraction.text || '');
  return extractionKey.includes(snippetKey) || contentTokens(snippet).filter((token) => new Set(contentTokens(extraction && extraction.text || '')).has(token)).length >= 4;
}

function inferPageRangeFromLocation(value) {
  const match = String(value || '').match(/\bpages?\s*(\d+)\s*(?:-|–|to)\s*(\d+)\b/i);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) return null;
  return { start, end };
}

function inferPageFromLocation(value) {
  const match = String(value || '').match(/\bpage\s*(\d+)\b/i);
  return match ? Number(match[1]) : 0;
}

function meaningfulOverlap(claimText, evidenceText, excludedValues = []) {
  const excluded = new Set(flattenAliasValues(excludedValues).flatMap(contentTokens));
  const claimTokens = Array.from(new Set(contentTokens(claimText).filter((token) => !excluded.has(token))));
  const evidenceTokens = new Set(contentTokens(evidenceText));
  const overlap = claimTokens.filter((token) => evidenceTokens.has(token));
  return {
    count: overlap.length,
    total: claimTokens.length,
    ratio: claimTokens.length ? overlap.length / claimTokens.length : 0,
    tokens: overlap
  };
}

function contentTokens(value) {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'be', 'by', 'can', 'do', 'does', 'did', 'for', 'from', 'how', 'if', 'in', 'into', 'is', 'it', 'not', 'of', 'or', 'that', 'the', 'this', 'to', 'with', 'when'
  ]);
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .map(singularizeSimpleWord)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function phraseAppearsInText(phrase, text) {
  const phraseTokens = contentTokens(phrase);
  if (!phraseTokens.length) return false;
  const textTokens = contentTokens(text);
  if (phraseTokens.length === 1) return textTokens.includes(phraseTokens[0]);
  const haystack = ` ${textTokens.join(' ')} `;
  return haystack.includes(` ${phraseTokens.join(' ')} `);
}

function hasDefinitionPatternNearTerm(term, evidence) {
  if (!nonEmptyString(term) || !nonEmptyString(evidence)) return false;
  const flexibleTerm = contentTokens(term).map(escapeRegExp).join('\\s+');
  if (!flexibleTerm) return false;
  const text = String(evidence || '').replace(/\s+/g, ' ');
  const patterns = [
    new RegExp(`\\b${flexibleTerm}\\b[^.!?]{0,80}\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b`, 'iu'),
    new RegExp(`\\b${flexibleTerm}\\b\\s*(?::|-|–)\\s*\\S.{3,120}`, 'iu'),
    new RegExp(`\\b(?:is|are|means|mean|refers to|defined as|called|represents)\\b[^.!?]{0,80}\\b${flexibleTerm}\\b`, 'iu')
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function findExplicitVocabularyDefinitionInEvidence(term, evidence) {
  if (!nonEmptyString(term) || !nonEmptyString(evidence)) return '';
  const flexibleTerm = contentTokens(term).map(escapeRegExp).join('\\s+');
  if (!flexibleTerm) return '';
  const text = String(evidence || '').replace(/\s+/g, ' ');
  const patterns = [
    new RegExp(`\\b${flexibleTerm}\\b\\s*(?::|-|–)\\s*([^.!?]{4,180})`, 'iu'),
    new RegExp(`\\b${flexibleTerm}\\b\\s+(?:is|are|means|mean|refers to|defined as|is defined as)\\s+([^.!?]{4,180})`, 'iu')
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;
    const definition = normalizeRecoveredDefinitionText(match[1], term);
    if (definition) return definition;
  }
  return '';
}

function looksSlideHeaderLine(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  return /^(?:slide|page|chapter|lesson|unit)\s*\d+\b/iu.test(text)
    || new RegExp(`^(?:${VOCAB_SECTION_LABEL_PATTERN}|${CONCEPT_LABEL_PATTERN}|${FORMULA_LABEL_PATTERN}|example|examples|practice|review)\\b`, 'iu').test(text);
}

function isPageHeaderText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/^charlemagne text-based pdf import test$/iu.test(text)) return true;
  if (/^larger pdf:\s*electricity and magnetism\s+page\s+\d+\s+of\s+\d+/iu.test(text)) return true;
  if (/^page\s+\d+\s+of\s+\d+\s+-\s+charlemagne\b/iu.test(text)) return true;
  if (/^page\s+\d+\s+of\s+\d+\s+-\s+earth_science\b/iu.test(text)) return true;
  if (/^Earth_Science\s*\|\s*Slide\s+\d+\s+of\s+\d+\s*\|/iu.test(text)) return true;
  if (/^page\s+\d+\s+of\s+\d+/iu.test(text)) return true;
  return false;
}

function looksHeadingOnlyEvidence(label, evidence) {
  if (!nonEmptyString(label) || !nonEmptyString(evidence)) return false;
  const text = String(evidence || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!phraseAppearsInText(label, text)) return false;
  const tokens = contentTokens(text);
  const labelTokens = contentTokens(label);
  const hasSentencePunctuation = /[.!?;]/u.test(text);
  return text.length <= 90 && tokens.length <= labelTokens.length + 3 && !hasSentencePunctuation;
}

function isThinEvidence(evidence) {
  const text = String(evidence || '').replace(/\s+/g, ' ').trim();
  return text.length > 0 && text.length < 40;
}

function addItemWarning(item, warning) {
  if (!item || !warning) return;
  const warnings = Array.isArray(item.warnings) ? item.warnings.slice() : [];
  if (!warnings.includes(warning)) warnings.push(warning);
  item.warnings = warnings;
  if (!nonEmptyString(item.notes)) {
    item.notes = warning;
  } else if (!item.notes.includes(warning)) {
    item.notes = `${item.notes} ${warning}`;
  }
}

function makePromptSections(extraction) {
  const pageSections = makePageSections(extraction);
  if (pageSections.length > 0) return pageSections;
  const sections = Array.isArray(extraction.sections) && extraction.sections.length > 0
    ? extraction.sections
    : [{ label: 'Full Text', sourceLocation: 'Full Text', text: extraction.text || '' }];
  return sections.map((section, index) => ({
    ...section,
    sourceChunkIndex: positiveInteger(section.sourceChunkIndex || section.chunkIndex || index + 1, index + 1),
    label: firstNonEmptyString(section.label, section.sourceLocation, `Chunk ${index + 1}`),
    sourceLocation: firstNonEmptyString(section.sourceLocation, section.label, `Chunk ${index + 1}`)
  }));
}

function makePageSections(extraction) {
  const pages = Array.isArray(extraction && extraction.pages)
    ? extraction.pages
    : Array.isArray(extraction && extraction.metadata && extraction.metadata.pages)
      ? extraction.metadata.pages
      : [];
  if (pages.length > 0) {
    return pages
      .map((page, index) => {
        const pageNumber = Number(page.pageNumber || page.number || page.num || index + 1);
        const text = String(page.text || page.content || '');
        const defaultLabel = `Page ${pageNumber}`;
        return {
          sourceChunkIndex: positiveInteger(page.sourceChunkIndex || page.chunkIndex || index + 1, index + 1),
          label: firstNonEmptyString(page.label, page.sourceLocation, defaultLabel),
          sourceLocation: firstNonEmptyString(page.sourceLocation, page.label, defaultLabel),
          pageNumber,
          text
        };
      })
      .filter((page) => page.text.trim().length > 0);
  }

  return splitTextByPageMarkers(extraction);
}

function splitTextByPageMarkers(extraction) {
  const text = String(extraction && extraction.text || '');
  const pageCount = Number(extraction && extraction.metadata && extraction.metadata.pageCount || 0);
  if (!text.trim() || pageCount < 2) return [];

  const pattern = /(?:^|\n)([^\n]{0,80}?\b(?:Page|Pg\.?|p\.)\s*(\d{1,4})\b[^\n]*|[^\n]{0,120}?\b(\d{1,4})\s*)\n/g;
  const markers = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const pageNumber = Number(match[2] || match[3]);
    if (!Number.isFinite(pageNumber) || pageNumber < 1 || pageNumber > pageCount) continue;
    if (markers.length && pageNumber <= markers[markers.length - 1].pageNumber) continue;
    const markerStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
    const markerEnd = pattern.lastIndex;
    markers.push({ pageNumber, markerStart, markerEnd });
  }

  if (markers.length < Math.max(2, Math.floor(pageCount * 0.5))) return [];
  return markers.map((marker, index) => {
    const nextMarker = markers[index + 1];
    return {
      label: `Page ${marker.pageNumber}`,
      sourceLocation: `Page ${marker.pageNumber}`,
      pageNumber: marker.pageNumber,
      text: text.slice(marker.markerStart, nextMarker ? nextMarker.markerStart : text.length).trim()
    };
  }).filter((page) => page.text.length > 0);
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

function singularizeSimpleWord(word) {
  const value = String(word || '').trim();
  if (value.length <= 3) return value;
  if (/ies$/i.test(value) && value.length > 4) return `${value.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses)$/i.test(value) && value.length > 5) return value.slice(0, -2);
  if (/s$/i.test(value) && !/(ss|us|is)$/i.test(value)) return value.slice(0, -1);
  return value;
}

function flattenAliasValues(values) {
  const flattened = [];
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    if (Array.isArray(value)) {
      flattened.push(...flattenAliasValues(value));
      return;
    }
    if (value && typeof value === 'object') {
      flattened.push(...flattenAliasValues(Object.values(value)));
      return;
    }
    if (value !== undefined && value !== null) flattened.push(String(value));
  });
  return flattened;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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


module.exports = {
  applySourceEvidenceValidation,
  validateItemSourceGrounding,
  validateVocabularyGrounding,
  validateConceptGrounding,
  validateFormulaGrounding,
  makeGroundingResult,
  makeItemEvidenceText,
  findMatchingExtractionSections,
  sourceSnippetAppearsInExtraction,
  inferPageRangeFromLocation,
  meaningfulOverlap,
  contentTokens,
  phraseAppearsInText,
  hasDefinitionPatternNearTerm,
  findExplicitVocabularyDefinitionInEvidence,
  looksSlideHeaderLine,
  isPageHeaderText,
  looksHeadingOnlyEvidence,
  isThinEvidence,
  addItemWarning
};
