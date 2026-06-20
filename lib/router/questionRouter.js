const { tryScienceFormula } = require('../formulas/scienceFormulaTools');
const { asksForGravityConstant } = require('../formulas/constants');
const { tryCircuitDiagram } = require('../circuits/circuitDiagramBuilder');
const { tryChemistryFormula } = require('../knowledge/chemistryTools');
const { tryPeriodicTable } = require('../knowledge/periodicTableTools');
const { tryMotionForceKnowledge } = require('../knowledge/physics/motion-force/motionForceKnowledge');
const { tryAmbiguousVocab, tryElectricityVocab, tryFreeBodyForces, tryPhysicsForcesVocab } = require('../vocab');
const { answerNarrowIntent } = require('./answerIntent');
const { buildKnowledgeAnswer, makeRoute } = require('./answerBuilder');
const {
  looksLikeDefinitionQuestion,
  looksLikeSafetyAdviceQuestion,
  looksLikeScienceQuestion,
  normalize
} = require('./classifyQuestion');
const { getMathToolName, tryMathOnly } = require('./mathCalculator');

function routeStudentQuestion(message, matchedKnowledge = []) {
  const text = String(message || '').trim();
  const normalized = normalize(text);

  const mathResult = tryMathOnly(text);
  if (mathResult) {
    return makeRoute({
      type: 'math_only',
      confidence: 'strong',
      toolsUsed: ['calculator', getMathToolName()],
      notes: `Calculated ${mathResult.expression} locally.`,
      calculatorResult: mathResult,
      directAnswer: mathResult.answer,
      aiAllowed: false
    });
  }

  if (looksLikeSafetyAdviceQuestion(normalized)) {
    return makeRoute({
      type: 'no_match',
      confidence: 'none',
      toolsUsed: [],
      notes: 'Safety or advice question blocked because no trusted local safety reference matched.',
      directAnswer: 'I do not have a trusted local safety fact for that yet. Please ask your teacher or another trusted adult before eating, touching, smelling, or using a chemical.',
      aiAllowed: false
    });
  }

  const clarificationGuard = guardWeakOrAmbiguousQuestion(normalized);
  if (clarificationGuard) {
    return makeRoute(clarificationGuard);
  }

  const approvedContextualKnowledge = findApprovedContextualKnowledge(normalized, matchedKnowledge);
  if (approvedContextualKnowledge) {
    return makeKnowledgeRoute(approvedContextualKnowledge, normalized, {
      notes: `Found strong approved civics match: ${approvedContextualKnowledge.title}. Answering before ambiguous science vocabulary.`
    });
  }

  const shouldTryFormulaFirst = looksLikeNumericFormulaQuestion(normalized) ||
    looksLikeFormulaProblem(normalized) ||
    asksForGravityConstant(normalized);
  const earlyScienceFormulaResult = shouldTryFormulaFirst ? tryScienceFormula(text) : null;
  if (earlyScienceFormulaResult) {
    return makeRoute({
      type: 'science_formula',
      confidence: 'strong',
      toolsUsed: ['science_formula_rules'],
      notes: earlyScienceFormulaResult.notes,
      directAnswer: earlyScienceFormulaResult.answer,
      formulaWork: earlyScienceFormulaResult.formulaWork,
      diagramText: earlyScienceFormulaResult.diagramText,
      aiAllowed: false
    });
  }

  const comparisonAnswer = answerKnownComparison(normalized, matchedKnowledge);
  if (comparisonAnswer) {
    return makeRoute({
      type: comparisonAnswer.confidence === 'none' ? 'no_match' : 'definition',
      confidence: comparisonAnswer.confidence || 'strong',
      toolsUsed: comparisonAnswer.toolsUsed,
      notes: comparisonAnswer.notes,
      directAnswer: comparisonAnswer.answer,
      aiAllowed: false
    });
  }

  const multiExampleAnswer = answerKnownMultiExample(normalized, matchedKnowledge);
  if (multiExampleAnswer) {
    return makeRoute({
      type: 'class_fact',
      confidence: 'strong',
      toolsUsed: multiExampleAnswer.toolsUsed,
      notes: multiExampleAnswer.notes,
      directAnswer: multiExampleAnswer.answer,
      aiAllowed: false
    });
  }

  const freeBodyForcesResult = tryFreeBodyForces(text);
  if (freeBodyForcesResult) {
    return makeRoute({
      type: 'science_concept',
      confidence: 'strong',
      toolsUsed: ['free_body_forces_concepts'],
      notes: `Answered local free-body forces concept question: ${freeBodyForcesResult.id}.`,
      directAnswer: freeBodyForcesResult.answer,
      aiAllowed: false
    });
  }

  const motionForceKnowledgeResult = tryMotionForceKnowledge(text);
  if (motionForceKnowledgeResult && shouldPreferMotionForceKnowledgeBeforeDefinition(normalized)) {
    return makeRoute(motionForceKnowledgeResult);
  }

  const directDefinitionKnowledge = findDirectDefinitionKnowledge(normalized, matchedKnowledge);
  if (directDefinitionKnowledge) {
    return makeKnowledgeRoute(directDefinitionKnowledge, normalized, {
      notes: `Found direct local definition match: ${directDefinitionKnowledge.title}. Answering before guided concept tutor.`
    });
  }

  if (motionForceKnowledgeResult) {
    return makeRoute(motionForceKnowledgeResult);
  }

  const ambiguousVocabResult = tryAmbiguousVocab(text);
  if (ambiguousVocabResult) {
    return makeRoute({
      type: ambiguousVocabResult.kind === 'ambiguous_vocab' ? 'ambiguous_vocab' : 'definition',
      confidence: 'strong',
      toolsUsed: ['ambiguous_vocab_rules'],
      notes: ambiguousVocabResult.kind === 'ambiguous_vocab'
        ? `Asked clarification for ambiguous vocabulary term: ${ambiguousVocabResult.id}.`
        : `Answered context-specific ambiguous vocabulary term: ${ambiguousVocabResult.id}.`,
      directAnswer: ambiguousVocabResult.answer,
      pendingClarification: ambiguousVocabResult.pendingClarification || null,
      aiAllowed: false
    });
  }

  const physicsVocabResult = tryPhysicsForcesVocab(text);
  if (physicsVocabResult && (!looksLikeFormulaProblem(normalized) || physicsVocabResult.id === 'unbalanced_forces_motion')) {
    return makeRoute({
      type: 'definition',
      confidence: 'strong',
      toolsUsed: ['physics_forces_vocab'],
      notes: `Answered local physics vocabulary question: ${physicsVocabResult.id}.`,
      directAnswer: physicsVocabResult.answer,
      aiAllowed: false
    });
  }

  if (!shouldTryFormulaFirst) {
    const scienceFormulaResult = tryScienceFormula(text);
    if (scienceFormulaResult) {
      return makeRoute({
        type: 'science_formula',
        confidence: 'strong',
        toolsUsed: ['science_formula_rules'],
        notes: scienceFormulaResult.notes,
        directAnswer: scienceFormulaResult.answer,
        formulaWork: scienceFormulaResult.formulaWork,
        diagramText: scienceFormulaResult.diagramText,
        aiAllowed: false
      });
    }
  }

  const circuitDiagramResult = tryCircuitDiagram(text);
  if (circuitDiagramResult) {
    return makeRoute({
      type: 'circuit_diagram',
      confidence: 'strong',
      toolsUsed: ['circuit_diagram_rules'],
      notes: `Answered local circuit diagram request: ${circuitDiagramResult.id}.`,
      directAnswer: circuitDiagramResult.answer,
      diagramText: circuitDiagramResult.diagramText,
      aiAllowed: false
    });
  }

  const narrowIntent = answerNarrowIntent(text);
  if (narrowIntent) {
    return makeRoute({
      type: narrowIntent.intent,
      confidence: 'strong',
      toolsUsed: ['answer_intent_rules'],
      notes: narrowIntent.notes,
      directAnswer: narrowIntent.answer,
      pendingClarification: narrowIntent.pendingClarification,
      aiAllowed: false
    });
  }

  const bestKnowledge = matchedKnowledge[0] || null;
  const teacherFirstKnowledge = findTeacherKnowledgeBeforeElectricity(normalized, matchedKnowledge);
  if (teacherFirstKnowledge) {
    return makeKnowledgeRoute(teacherFirstKnowledge, normalized, {
      notes: `Found strong local match: ${teacherFirstKnowledge.title}. Answering before narrower electricity vocabulary.`
    });
  }

  const electricityVocabResult = tryElectricityVocab(text);
  if (electricityVocabResult) {
    return makeRoute({
      type: electricityVocabResult.kind === 'electricity_concept' ? 'science_concept' : 'definition',
      confidence: 'strong',
      toolsUsed: ['electricity_magnetism_knowledge_pack'],
      notes: `Answered local electricity/magnetism knowledge question: ${electricityVocabResult.id}.`,
      directAnswer: electricityVocabResult.answer,
      aiAllowed: false
    });
  }

  const periodicTableResult = tryPeriodicTable(text);
  if (periodicTableResult) {
    return makeRoute({
      type: 'periodic_table',
      confidence: 'strong',
      toolsUsed: ['local_periodic_table'],
      notes: periodicTableResult.notes,
      directAnswer: periodicTableResult.answer,
      aiAllowed: false
    });
  }

  const chemistryResult = tryChemistryFormula(text);
  if (chemistryResult) {
    return makeRoute({
      type: 'chemistry_formula',
      confidence: 'strong',
      toolsUsed: ['chemistry_compounds'],
      notes: `Found ${chemistryResult.formula} as ${chemistryResult.name}.`,
      directAnswer: chemistryResult.student_answer || `${chemistryResult.formula} is ${chemistryResult.name}. It is a ${chemistryResult.type}. ${chemistryResult.note}`,
      aiAllowed: false
    });
  }

  if (/\bmoms\s+law\b/.test(normalized)) {
    return makeRoute(missingTrustedAnswer({
      normalized,
      notes: 'Blocked typo-adjacent law question; asking whether student meant Ohm’s Law.',
      directAnswer: 'Did you mean Ohm’s Law? If so, ask “What is Ohm’s Law?” or “What is oms law?”'
    }));
  }

  if (bestKnowledge && looksLikeRelationshipQuestion(normalized) && isStrongRelationshipKnowledgeMatch(bestKnowledge)) {
    return makeKnowledgeRoute(bestKnowledge, normalized, {
      notes: `Found strong trusted relationship match: ${bestKnowledge.title}. Answering before broad relationship guard.`
    });
  }

  if (looksLikeRelationshipQuestion(normalized)) {
    return makeRoute(missingTrustedAnswer({
      normalized,
      notes: 'No trusted local relationship rule matched.',
      directAnswer: 'I do not have a trusted local fact that explains that relationship yet. Please ask your teacher to add that relationship to the knowledge pack.'
    }));
  }

  if (bestKnowledge) {
    const weakFallbackBlock = shouldBlockWeakKnowledgeFallback(normalized, bestKnowledge);
    if (weakFallbackBlock) {
      return makeRoute(weakFallbackBlock);
    }

    return makeKnowledgeRoute(bestKnowledge, normalized);
  }

  if (looksLikeIncompleteFragment(normalized)) {
    return makeRoute({
      type: 'no_match',
      confidence: 'none',
      toolsUsed: ['router_fragment_guard'],
      notes: 'Blocked incomplete prompt with no clear local match.',
      directAnswer: 'That looks like an incomplete question or sentence fragment. Please send the full question, including the missing blank or answer choices if there are any.',
      aiAllowed: false
    });
  }

  const possibleScience = looksLikeScienceQuestion(normalized);
  return makeRoute({
    type: possibleScience ? 'no_match' : 'no_match',
    confidence: 'none',
    toolsUsed: [],
    notes: possibleScience
      ? 'No trusted local science match found. Blocking free science answer.'
      : 'No trusted local match found.',
    directAnswer: possibleScience
      ? 'I do not have a trusted local science fact for that yet. Please reword the question with the vocabulary word, formula, or numbers you are asking about, or ask your teacher.'
      : 'I do not have a trusted local fact for that yet. Please reword the question or ask your teacher.',
    aiAllowed: false
  });
}

function shouldBlockWeakKnowledgeFallback(normalized, bestKnowledge = {}) {
  if (isStrongKnowledgeMatch(bestKnowledge)) return null;

  if (looksLikeIncompleteFragment(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak related-fact fallback for incomplete prompt. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'That looks like an incomplete question or sentence fragment. Please send the full question, including the missing blank or answer choices if there are any.'
    });
  }

  if (/\bmoms\s+law\b/.test(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: 'Blocked typo-adjacent law question; asking whether student meant Ohm’s Law.',
      directAnswer: 'Did you mean Ohm’s Law? If so, ask “What is Ohm’s Law?” or “What is oms law?”'
    });
  }

  if (looksLikeRelationshipQuestion(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak related-fact fallback for relationship question. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'I do not have a trusted local fact that explains that relationship yet. Please ask your teacher to add that relationship to the knowledge pack.'
    });
  }

  if (looksLikePersonQuestion(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak related-fact fallback for person question. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'I do not have a trusted local fact for that person yet. Ask your teacher to add one to the knowledge pack.'
    });
  }

  if (looksLikePurposeQuestion(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak related-fact fallback for purpose question. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'I do not have a trusted local fact for the point or purpose of that yet. Ask your teacher or reword with a specific class topic.'
    });
  }

  if (looksLikeVagueExampleRequest(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak related-fact fallback for context-dependent example request. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'What topic do you want an example of? Tell me the vocabulary word or formula you are asking about.'
    });
  }

  if (looksLikeScienceQuestion(normalized)) {
    return missingTrustedAnswer({
      normalized,
      notes: `Blocked weak science fallback. Best weak match: ${bestKnowledge.title}.`,
      directAnswer: 'I do not have a trusted local science fact for that yet. Please reword the question with the vocabulary word, formula, or numbers you are asking about, or ask your teacher.'
    });
  }

  return null;
}

function isStrongKnowledgeMatch(item = {}) {
  return Boolean(
    item.exactTermMatch ||
    item.exactTitleMatch ||
    item.score >= 18 ||
    item.strongestPhraseWordCount >= 3
  );
}

function findTeacherKnowledgeBeforeElectricity(normalized, matchedKnowledge = []) {
  return matchedKnowledge.find((item) => shouldPreferTeacherKnowledgeBeforeElectricity(normalized, item)) || null;
}

function findDirectDefinitionKnowledge(normalized, matchedKnowledge = []) {
  if (!looksLikeDefinitionQuestion(normalized)) return null;
  if (looksLikeNumericFormulaQuestion(normalized) || looksLikeFormulaProblem(normalized)) return null;

  return matchedKnowledge.find((item) => item.id === 'acceleration' && isStrongKnowledgeMatch(item)) || null;
}

function shouldPreferTeacherKnowledgeBeforeElectricity(normalized, item = {}) {
  const teacherFirstIds = new Set([
    'power',
    'specific-heat',
    'chemical-energy',
    'elastic-potential-energy',
    'work-unit'
  ]);

  if (!teacherFirstIds.has(item.id) || !isStrongKnowledgeMatch(item)) return false;
  if (looksLikeRelationshipQuestion(normalized)) return false;
  if (item.id === 'power' && /\b(?:electrical|electric|circuit|voltage|current|amps?|amperes?)\b/.test(normalized)) {
    return false;
  }

  return true;
}

function missingTrustedAnswer({ normalized, notes, directAnswer }) {
  const possibleScience = looksLikeScienceQuestion(normalized);
  return {
    type: 'no_match',
    confidence: 'none',
    toolsUsed: [],
    notes,
    directAnswer: directAnswer || (possibleScience
      ? 'I do not have a trusted local science fact for that yet. Please reword the question with the vocabulary word, formula, or numbers you are asking about, or ask your teacher.'
      : 'I do not have a trusted local fact for that yet. Please reword the question or ask your teacher.'),
    aiAllowed: false
  };
}

function looksLikeRelationshipQuestion(normalized) {
  return /\bhow\s+(?:is|are)\b.+\brelated\b/.test(normalized) ||
    /\brelationship\s+between\b/.test(normalized);
}

function isStrongRelationshipKnowledgeMatch(item = {}) {
  if (!isStrongKnowledgeMatch(item)) return false;

  const relationshipText = normalize([
    item.id,
    item.title,
    item.category,
    ...(item.exactTermMatches || []),
    ...(item.phraseMatches || [])
  ].join(' '));

  return /\brelationship\b/.test(relationshipText) ||
    (item.strongestPhraseWordCount >= 3 && /\b[a-z0-9]+\s+and\s+[a-z0-9]+\b/.test(relationshipText));
}

function looksLikePersonQuestion(normalized) {
  return /\bwho\s+(?:is|was|are|were)\b/.test(normalized);
}

function looksLikePurposeQuestion(normalized) {
  return /\b(?:what\s+is|whats)\s+the\s+(?:point|purpose)\s+of\b/.test(normalized) ||
    /\bwhy\s+(?:does|do|is|are)\b.+\bmatter\b/.test(normalized);
}

function looksLikeIncompleteFragment(normalized) {
  const text = String(normalized || '').trim();
  if (!text) return false;

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length > 8) return false;
  if (/[?]$/.test(text) && /\b(?:what|which|why|how|when|where|who|can|does|do|is|are)\b/.test(text)) return false;

  return /\b(?:a|an|the|of|to|with|on|in|at|by|for|from|its|his|her|their)\s*$/.test(text) ||
    /^(?:this|that|it)\s+(?:is|was|depends|dependent)\b/.test(text);
}

function looksLikeFormulaProblem(normalized) {
  return /(?:\d|=|μ|µ|\bif\b|\bgiven\b|\bcalculate\b|\bsolve\b|\bfind\b|\bdetermine\b|\bhow\s+much\b|\bhow\s+many\b|\bformula\b)/.test(normalized) ||
    (/\bdistance\b/.test(normalized) && /\bdisplacement\b/.test(normalized) && /\b(?:spin|spins|spinning|turns?|twirls?)\b/.test(normalized));
}

function looksLikeNumericFormulaQuestion(normalized) {
  if (!hasMeaningfulNumber(normalized)) return false;

  const hasFormulaVocabulary = /\b(?:acceleration|accelerates?|accelerated|accelerating|speed|velocity|final\s+velocity|final\s+speed|distance|displacement|time|force|mass|weight|work|power|energy|density|volume|momentum)\b/.test(normalized);
  const hasFormulaAsk = /\b(?:find|calculate|solve|determine)\b/.test(normalized) ||
    /\bwhat\s+(?:is|are|will|would|was|were)\b/.test(normalized) ||
    /\bhow\s+(?:far|fast|long|much|many)\b/.test(normalized) ||
    /\bwhat\s+(?:speed|velocity|acceleration|distance|time)\b/.test(normalized);

  return hasFormulaVocabulary && hasFormulaAsk;
}

function hasMeaningfulNumber(normalized) {
  return /(?:\d+(?:\.\d+)?|\bzero\b|\bone\b|\btwo\b|\bthree\b|\bfour\b|\bfive\b|\bsix\b|\bseven\b|\beight\b|\bnine\b|\bten\b|\beleven\b|\btwelve\b)/.test(normalized);
}

function findApprovedContextualKnowledge(normalized, matchedKnowledge) {
  if (!hasCivicsContext(normalized)) return null;

  const candidates = (matchedKnowledge || [])
    .filter((item) => isApprovedKnowledgeItem(item))
    .filter((item) => itemMatchesCivicsContext(item))
    .filter((item) => hasStrongPhraseMatch(item))
    .sort((a, b) => {
      const phraseDifference = (b.strongestPhraseWordCount || 0) - (a.strongestPhraseWordCount || 0);
      if (phraseDifference !== 0) return phraseDifference;
      return (b.score || 0) - (a.score || 0);
    });

  return candidates[0] || null;
}

function isApprovedKnowledgeItem(item = {}) {
  return /^approved_/.test(String(item.category || '')) ||
    String(item.id || '').startsWith('approved-pack:');
}

function itemMatchesCivicsContext(item = {}) {
  if (Array.isArray(item.subjectContextMatches) && item.subjectContextMatches.includes('civics')) {
    return true;
  }

  return hasCivicsContext(normalize([
    item.subject,
    item.category,
    item.title,
    item.fact,
    item.source,
    ...(item.terms || [])
  ].join(' ')));
}

function hasStrongPhraseMatch(item = {}) {
  if (item.exactTitleMatch && wordCount(item.title) >= 2) return true;
  if ((item.exactTermMatches || []).some((term) => wordCount(term) >= 2)) return true;
  if ((item.phraseMatches || []).some((phrase) => wordCount(phrase) >= 3)) return true;
  return (item.strongestPhraseWordCount || 0) >= 3;
}

function hasCivicsContext(normalized) {
  return /\b(branch|branches|government|laws?|courts?|judges?|judicial|legislative|executive|constitution|checks\s+and\s+balances|civics?|citizens?|representatives?|voting|amendments?)\b/.test(normalized);
}

function wordCount(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function makeKnowledgeRoute(bestKnowledge, normalized, options = {}) {
  const isStrong = Boolean(
    bestKnowledge.exactTermMatch ||
    bestKnowledge.exactTitleMatch ||
    bestKnowledge.score >= 18 ||
    bestKnowledge.strongestPhraseWordCount >= 3
  );
  const isDefinitionQuestion = looksLikeDefinitionQuestion(normalized);
  const isExampleRequest = looksLikeExampleRequest(normalized);
  const toolsUsed = isApprovedKnowledgeItem(bestKnowledge) ? ['teacher_facts', 'approved_teacher_content'] : ['teacher_facts'];

  return makeRoute({
    type: isDefinitionQuestion ? 'definition' : 'class_fact',
    confidence: isStrong ? 'strong' : 'weak',
    toolsUsed,
    notes: options.notes || (isStrong
      ? `Found strong local match: ${bestKnowledge.title}. Answering directly from teacher facts${isExampleRequest ? ' with example-first formatting' : ''}.`
      : `Found related local match: ${bestKnowledge.title}. Answering directly from teacher facts${isExampleRequest ? ' with example-first formatting' : ''}.`),
    directAnswer: buildKnowledgeAnswer(bestKnowledge, isStrong, {
      preferExample: isExampleRequest
    }),
    aiAllowed: false
  });
}

function looksLikeExampleRequest(normalized) {
  return /\bexample\s+of\b/.test(normalized) ||
    /\bgive\s+me\s+(?:an|and|a)\s+example\b/.test(normalized) ||
    /\bcan\s+you\s+(?:show|give)\s+(?:me\s+)?(?:an|and|a)?\s*example\b/.test(normalized) ||
    /\bshow\s+(?:me\s+)?(?:an|and|a)?\s*example\b/.test(normalized);
}

function shouldPreferMotionForceKnowledgeBeforeDefinition(normalized) {
  return /\bwhy\b.*\bknown\s+as\b/.test(normalized);
}

function looksLikeVagueExampleRequest(normalized) {
  return /^(?:can\s+you\s+)?(?:give|show)\s+(?:me\s+)?(?:an|and|a)?\s*example\s+of\s+(?:each|both)\b/.test(normalized) ||
    /^(?:an?\s+)?example\s+of\s+(?:each|both)\b/.test(normalized) ||
    /\bexample\s+of\s+(?:each|both)\b/.test(normalized);
}

function answerKnownMultiExample(normalized, matchedKnowledge = []) {
  if (!looksLikeExampleRequest(normalized)) return null;

  const groupMatch = findKnownComparisonGroup(normalized);
  if (groupMatch) {
    const concepts = groupMatch.concepts.map((concept) => ({
      ...concept,
      knowledge: concept.knowledgeId ? findMatchedKnowledgeById(matchedKnowledge, concept.knowledgeId) : null
    }));
    return buildMultiExampleAnswer(concepts, groupMatch.group);
  }

  const pair = KNOWN_COMPARISON_PAIRS.find((candidate) => questionMentionsPair(normalized, candidate));
  if (!pair) return null;

  const concepts = pair.concepts.map((concept) => ({
    ...concept,
    knowledge: concept.knowledgeId ? findMatchedKnowledgeById(matchedKnowledge, concept.knowledgeId) : null
  }));

  if (pair.requiresTeacherFacts && concepts.some((concept) => !concept.knowledge)) return null;

  return buildMultiExampleAnswer(orderConceptsByQuestion(normalized, concepts), pair);
}

function buildMultiExampleAnswer(concepts, source) {
  const answer = concepts
    .map((concept) => formatConceptExample(concept))
    .filter(Boolean)
    .join('\n');

  if (!answer) return null;

  return {
    toolsUsed: source.toolsUsed,
    notes: `Answered examples for compared topics: ${source.id}.`,
    answer
  };
}

function formatConceptExample(concept) {
  const knowledge = concept.knowledge || {};
  const title = knowledge.title || titleCase(concept.label);
  const examples = Array.isArray(knowledge.examples) ? knowledge.examples : [];
  const example = examples[0] || concept.localExample;
  if (!example) return '';

  const connection = knowledge.formula
    ? `This shows ${title} because ${knowledge.formula}.`
    : firstSentence(knowledge.fact || concept.localFact)
      ? `This connects to ${title}: ${firstSentence(knowledge.fact || concept.localFact)}`
      : `This is an example of ${title}.`;

  return `${title} example: ${example}\n${connection}`;
}

function answerKnownComparison(normalized, matchedKnowledge = []) {
  if (!looksLikeComparisonQuestion(normalized)) return null;

  const ohmsRelationship = answerOhmsRelationship(normalized, matchedKnowledge);
  if (ohmsRelationship) return ohmsRelationship;

  const groupAnswer = answerKnownComparisonGroup(normalized, matchedKnowledge);
  if (groupAnswer) return groupAnswer;

  const pair = KNOWN_COMPARISON_PAIRS.find((candidate) => questionMentionsPair(normalized, candidate));
  if (!pair) return null;

  const conceptItems = pair.concepts.map((concept) => ({
    ...concept,
    knowledge: concept.knowledgeId ? findMatchedKnowledgeById(matchedKnowledge, concept.knowledgeId) : null
  }));

  if (pair.requiresTeacherFacts && conceptItems.some((concept) => !concept.knowledge)) {
    return null;
  }

  const orderedConcepts = orderConceptsByQuestion(normalized, conceptItems);
  const answerParts = [
    pair.relationship,
    ...orderedConcepts.map((concept) => formatComparisonConcept(concept)),
    pair.difference
  ].filter(Boolean);

  return {
    toolsUsed: pair.toolsUsed,
    notes: `Answered known comparison: ${pair.id}.`,
    answer: answerParts.join(' ')
  };
}

function answerOhmsRelationship(normalized, matchedKnowledge = []) {
  const mentionsVoltage = /\b(?:voltage|volt|volts)\b/.test(normalized);
  const mentionsCurrent = /\b(?:current|amp|amps|amperes?)\b/.test(normalized);
  const mentionsResistance = /\b(?:resistance|ohms?)\b/.test(normalized);
  if (!mentionsVoltage || !mentionsCurrent) return null;

  const ohmsLaw = findMatchedKnowledgeById(matchedKnowledge, 'ohms-law');
  if (ohmsLaw) {
    return {
      toolsUsed: ['teacher_facts', 'comparison_rules'],
      notes: 'Answered voltage/current relationship using trusted Ohm’s Law fact.',
      answer: `${ohmsLaw.fact} Formula: ${ohmsLaw.formula}. Current is measured in amps and voltage is measured in volts.`
    };
  }

  return null;
}

function answerKnownComparisonGroup(normalized, matchedKnowledge = []) {
  const groupMatch = findKnownComparisonGroup(normalized);
  if (!groupMatch) return null;

  const conceptItems = groupMatch.concepts.map((concept) => ({
    ...concept,
    knowledge: concept.knowledgeId ? findMatchedKnowledgeById(matchedKnowledge, concept.knowledgeId) : null
  }));
  const missingConcepts = conceptItems.filter((concept) => !concept.knowledge);

  if (missingConcepts.length > 0) {
    return {
      toolsUsed: groupMatch.group.toolsUsed,
      notes: `Missing trusted local facts for comparison: ${missingConcepts.map((concept) => concept.label).join(', ')}.`,
      answer: buildMissingComparisonAnswer(conceptItems)
    };
  }

  const orderedConcepts = orderConceptsByQuestion(normalized, conceptItems);
  const answerParts = [
    groupMatch.group.relationship,
    ...orderedConcepts.map((concept) => formatComparisonConcept(concept)),
    groupMatch.group.difference
  ].filter(Boolean);

  return {
    toolsUsed: groupMatch.group.toolsUsed,
    notes: `Answered known comparison: ${groupMatch.group.id}.`,
    answer: answerParts.join(' ')
  };
}

function looksLikeComparisonQuestion(normalized) {
  return /\bdifference\s+between\b/.test(normalized) ||
    /\bcompare\b/.test(normalized) ||
    /\bvs\b/.test(normalized) ||
    /\bversus\b/.test(normalized) ||
    /\bhow\s+(?:is|are)\b.+\brelated\b/.test(normalized) ||
    /\bhow\s+are\b.+\bdifferent\b/.test(normalized) ||
    (looksLikeDefinitionQuestion(normalized) && /\band\b/.test(normalized));
}

function findMatchedKnowledgeById(matchedKnowledge = [], id) {
  return matchedKnowledge.find((item) => item.id === id) || null;
}

const KNOWN_COMPARISON_GROUPS = [
  {
    id: 'atom-particles',
    toolsUsed: ['teacher_facts', 'comparison_rules'],
    concepts: [
      {
        knowledgeId: 'proton',
        label: 'proton',
        aliases: ['proton', 'protons']
      },
      {
        knowledgeId: 'neutron',
        label: 'neutron',
        aliases: ['neutron', 'neutrons']
      },
      {
        knowledgeId: 'electron',
        label: 'electron',
        aliases: ['electron', 'electrons']
      }
    ],
    relationship: 'Protons, neutrons, and electrons are particles found in atoms.',
    difference: 'So the short comparison is positive charge in the nucleus for protons, no charge in the nucleus for neutrons, and negative charge outside the nucleus for electrons.'
  },
  {
    id: 'newtons-laws',
    toolsUsed: ['teacher_facts', 'comparison_rules'],
    requiredContext: /\bnewtons?\b.*\blaws?\b|\blaws?\b.*\bnewtons?\b/,
    concepts: [
      {
        knowledgeId: 'newtons-first-law',
        label: "Newton's First Law",
        aliases: ['newtons first law', 'newton first law', 'newton s first law', 'first law'],
        ordinalPattern: /\b(?:first|1st|one)\b/,
        localExample: 'A soccer ball stays still on the grass until someone kicks it.'
      },
      {
        knowledgeId: 'newtons-second-law',
        label: "Newton's Second Law",
        aliases: ['newtons second law', 'newton second law', 'newton s second law', 'second law'],
        ordinalPattern: /\b(?:second|2nd|two)\b/
      },
      {
        knowledgeId: 'newtons-third-law',
        label: "Newton's Third Law",
        aliases: ['newtons third law', 'newton third law', 'newton s third law', 'third law'],
        ordinalPattern: /\b(?:third|3rd|three)\b/
      }
    ],
    relationship: "Newton's laws describe different ideas about forces and motion.",
    difference: "So the short comparison is that each law focuses on a different part of forces and motion."
  }
];

const KNOWN_COMPARISON_PAIRS = [
  {
    id: 'transverse-waves-vs-longitudinal-waves',
    toolsUsed: ['teacher_facts', 'comparison_rules'],
    requiresTeacherFacts: true,
    concepts: [
      {
        knowledgeId: 'transverse-waves',
        label: 'transverse wave',
        aliases: ['transverse', 'transverse wave', 'transverse waves']
      },
      {
        knowledgeId: 'longitudinal-waves',
        label: 'longitudinal wave',
        aliases: ['longitudinal', 'longitudinal wave', 'longitudinal waves']
      }
    ],
    requiredContext: /\bwaves?\b/,
    relationship: 'Transverse and longitudinal waves are different because the medium moves in different directions compared with the wave.',
    difference: 'So the simple difference is perpendicular motion for transverse waves and parallel motion for longitudinal waves.'
  },
  {
    id: 'kinetic-energy-vs-potential-energy',
    toolsUsed: ['teacher_facts', 'comparison_rules'],
    requiresTeacherFacts: true,
    concepts: [
      {
        knowledgeId: 'kinetic-energy',
        label: 'kinetic energy',
        aliases: ['kinetic energy', 'kinetic']
      },
      {
        knowledgeId: 'potential-energy-gravity',
        label: 'potential energy',
        aliases: ['potential energy', 'gravitational potential energy', 'potential']
      }
    ],
    relationship: 'Kinetic energy and potential energy are related because both are forms of energy.',
    difference: 'The simple difference is that kinetic energy depends on motion, while gravitational potential energy is stored energy based on mass, gravity, and height.'
  },
  {
    id: 'mass-vs-weight',
    toolsUsed: ['teacher_facts', 'comparison_rules'],
    requiresTeacherFacts: false,
    concepts: [
      {
        label: 'mass',
        aliases: ['mass'],
        localFact: 'Mass is the amount of matter in an object.'
      },
      {
        label: 'weight',
        aliases: ['weight'],
        localFact: 'Weight is the force of gravity on an object and can change when location or gravity changes.'
      }
    ],
    relationship: 'Mass and weight are related because an object with mass can have weight when gravity pulls on it.',
    difference: 'The simple difference is that mass is matter, while weight is a force of gravity.'
  },
  {
    id: 'distance-vs-displacement',
    toolsUsed: ['physics_forces_vocab', 'comparison_rules'],
    concepts: [
      {
        label: 'distance',
        aliases: ['distance'],
        localFact: 'Distance is the total path traveled. Distance is the total length traveled, no matter which direction something moves.'
      },
      {
        label: 'displacement',
        aliases: ['displacement'],
        localFact: 'Displacement is the straight-line change from start to finish, including direction. Displacement is how far and in what direction something is from where it started.'
      }
    ],
    relationship: 'Distance and displacement are both ways to describe how an object moves from place to place.',
    difference: 'The simple difference is that distance is the total path traveled, while displacement is the straight-line change from start to finish and includes direction.'
  }
];

function findKnownComparisonGroup(normalized) {
  for (const group of KNOWN_COMPARISON_GROUPS) {
    if (group.requiredContext && !group.requiredContext.test(normalized)) continue;

    const concepts = group.concepts.filter((concept) => comparisonGroupMentionsConcept(normalized, concept));
    if (concepts.length >= 2 && concepts.length <= 3) {
      return { group, concepts };
    }
  }

  return null;
}

function comparisonGroupMentionsConcept(normalized, concept) {
  if (concept.aliases.some((alias) => hasPhrase(normalized, alias))) return true;
  return Boolean(concept.ordinalPattern && concept.ordinalPattern.test(normalized));
}

function questionMentionsPair(normalized, pair) {
  if (pair.requiredContext && !pair.requiredContext.test(normalized)) return false;
  return pair.concepts.every((concept) => concept.aliases.some((alias) => hasPhrase(normalized, alias)));
}

function orderConceptsByQuestion(normalized, concepts) {
  return concepts
    .map((concept, index) => ({
      concept,
      index,
      position: firstAliasPosition(normalized, concept.aliases)
    }))
    .sort((left, right) => {
      if (left.position !== right.position) return left.position - right.position;
      return left.index - right.index;
    })
    .map((entry) => entry.concept);
}

function firstAliasPosition(normalized, aliases = []) {
  const positions = aliases
    .map((alias) => normalized.indexOf(alias))
    .filter((position) => position >= 0);
  return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
}

function formatComparisonConcept(concept) {
  const knowledge = concept.knowledge || {};
  const title = knowledge.title || titleCase(concept.label);
  const fact = knowledge.fact || concept.localFact || '';
  const formula = knowledge.formula ? ` Formula: ${knowledge.formula}.` : '';

  return `${title}: ${ensureSentence(fact)}${formula}`;
}

function buildMissingComparisonAnswer(concepts) {
  const available = concepts.filter((concept) => concept.knowledge);
  const missing = concepts.filter((concept) => !concept.knowledge);
  const missingLabel = formatList(missing.map((concept) => concept.label));

  if (available.length === 1) {
    return `I only have a trusted local fact for ${available[0].label} right now. I do not have trusted local facts for ${missingLabel} yet. Ask your teacher to add them to a knowledge pack.`;
  }

  if (available.length > 1) {
    return `I have trusted local facts for ${formatList(available.map((concept) => concept.label))}, but I do not have trusted local facts for ${missingLabel} yet. Ask your teacher to add them to a knowledge pack.`;
  }

  return `I do not have trusted local facts for ${missingLabel} yet. Ask your teacher to add them to a knowledge pack.`;
}

function formatList(values = []) {
  const items = values.filter(Boolean);
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function ensureSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function titleCase(value) {
  return String(value || '')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function firstSentence(value) {
  const text = String(value || '').trim();
  const match = /^.*?[.!?](?:\s|$)/.exec(text);
  return (match ? match[0] : text).trim();
}

function hasPhrase(text, phrase) {
  const escaped = String(phrase || '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function guardWeakOrAmbiguousQuestion(normalized) {
  if (/^(?:what\s+is|whats|define)\s+(?:a\s+)?cell\s*\??$/.test(normalized)) {
    return {
      type: 'ambiguous_vocab',
      confidence: 'strong',
      toolsUsed: ['router_clarification_guard'],
      notes: 'Asked clarification for ambiguous bare vocabulary term: cell.',
      directAnswer: [
        'Cell can mean more than one thing. Which kind of cell are you asking about?',
        '1. Battery cell',
        '2. Living cell',
        '3. Spreadsheet cell'
      ].join('\n'),
      pendingClarification: {
        id: 'ambiguous_vocab_cell',
        toolsUsed: ['router_clarification_guard'],
        invalidChoiceMessage: 'Please type 1 for battery cell, 2 for living cell, or 3 for spreadsheet cell.',
        choices: [
          {
            number: 1,
            label: 'Battery cell',
            intent: 'definition',
            toolsUsed: ['electricity_magnetism_knowledge_pack'],
            notes: 'Answered ambiguous vocabulary choice: battery cell.',
            answer: 'A battery cell is a power source that converts chemical energy into electrical energy. It provides the voltage difference that pushes charge through a circuit.'
          },
          {
            number: 2,
            label: 'Living cell',
            intent: 'no_match',
            toolsUsed: ['router_clarification_guard'],
            notes: 'Living cell was selected, but no trusted local science fact is available yet.',
            answer: 'I do not have a trusted local science fact for living cell yet. Please ask your teacher or reword with a vocabulary term from your local class notes.'
          },
          {
            number: 3,
            label: 'Spreadsheet cell',
            intent: 'no_match',
            toolsUsed: ['router_clarification_guard'],
            notes: 'Spreadsheet cell was selected, but no trusted local science fact is available yet.',
            answer: 'I do not have a trusted local science fact for spreadsheet cell yet. Please ask your teacher or reword with a vocabulary term from your local class notes.'
          }
        ]
      },
      aiAllowed: false
    };
  }

  if (/\bpower\b/.test(normalized) && /\bonly\s+know\s+time\b/.test(normalized)) {
    return {
      type: 'no_match',
      confidence: 'none',
      toolsUsed: ['router_clarification_guard'],
      notes: 'Rejected power calculation with only time given.',
      directAnswer: 'I do not have enough values to find power from only time. For work/time power, I need work or energy and time.',
      aiAllowed: false
    };
  }

  if (/\bacceleration\b/.test(normalized) && /\b(?:moves?|going|goes)\s+fast\b/.test(normalized)) {
    return {
      type: 'no_match',
      confidence: 'none',
      toolsUsed: ['router_clarification_guard'],
      notes: 'Rejected acceleration calculation with only vague speed wording.',
      directAnswer: 'I do not have enough values to find acceleration from "moves fast." I need the change in velocity and the time, or force and mass.',
      aiAllowed: false
    };
  }

  return null;
}

module.exports = {
  routeStudentQuestion
};
