const fs = require('node:fs');
const path = require('node:path');

const { loadApprovedPackActivation } = require('./approvedPackActivationStore');
const { DEFAULT_APPROVED_PACKS_DIR, loadApprovedKnowledgePacks } = require('./loadApprovedKnowledgePacks');
const { loadEnabledApprovedKnowledgeItems } = require('./loadEnabledApprovedKnowledgeItems');
const { findRelevantKnowledge } = require('./teacherKnowledge');
const { routeStudentQuestion } = require('../router/questionRouter');

function diagnoseApprovedKnowledgePipeline(options = {}) {
  const approvedPacksDir = path.resolve(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR);
  const packId = String(options.packId || '').trim();
  const question = String(options.question || '').trim();
  const maxKnowledgeItems = Number(options.maxKnowledgeItems || 6);
  const findRelevant = options.findRelevantKnowledge || findRelevantKnowledge;
  const routeQuestion = options.routeStudentQuestion || routeStudentQuestion;

  const expectedPackPath = packId
    ? path.join(approvedPacksDir, packId, 'knowledge_pack.json')
    : '';
  const packFileExists = expectedPackPath ? fs.existsSync(expectedPackPath) : false;
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir,
    includeFixtures: options.includeFixtures === true,
    includeExamples: options.includeExamples === true,
    validationOptions: options.validationOptions || {}
  });
  const approvedRecord = packId
    ? approved.packs.find((record) => record.packId === packId) || null
    : null;
  const activation = loadApprovedPackActivation({ approvedPacksDir });
  const activationRecord = packId ? activation.packs[packId] || null : null;
  const activationEnabled = Boolean(activationRecord && activationRecord.enabled === true);
  const enabledItems = loadEnabledApprovedKnowledgeItems({
    approvedPacksDir,
    includeFixtures: options.includeFixtures === true,
    includeExamples: options.includeExamples === true,
    validationOptions: options.validationOptions || {}
  });
  const packEnabledItems = packId
    ? enabledItems.filter((item) => String(item.id || '').startsWith(`approved-pack:${packId}:`))
    : enabledItems;
  const matches = question
    ? findRelevant(question, enabledItems, maxKnowledgeItems)
    : [];
  const route = question
    ? routeQuestion(question, matches)
    : null;
  const failedStage = determineFailedStage({
    packId,
    packFileExists,
    approvedRecord,
    activationEnabled,
    packEnabledItems,
    matches,
    route
  });

  return {
    ok: failedStage === '',
    failedStage,
    approvedPacksDir,
    packId,
    question,
    expectedPackPath,
    packFileExists,
    packLoaded: Boolean(approvedRecord),
    approvedPackErrors: approved.errors || [],
    activationEnabled,
    activationRecord,
    enabledItemCount: enabledItems.length,
    packEnabledItemCount: packEnabledItems.length,
    matchedKnowledge: matches.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      score: item.score,
      exactTermMatch: item.exactTermMatch === true,
      exactTitleMatch: item.exactTitleMatch === true
    })),
    route: route
      ? {
          type: route.type,
          confidence: route.confidence,
          notes: route.notes,
          toolsUsed: route.toolsUsed || [],
          directAnswer: route.directAnswer || ''
        }
      : null
  };
}

function determineFailedStage(state = {}) {
  if (!state.packId) return 'missing_pack_id';
  if (!state.packFileExists) return 'no_approved_pack_written';
  if (!state.approvedRecord) return 'approved_pack_loader_skipped_pack';
  if (!state.activationEnabled) return 'approved_pack_not_activated';
  if (!state.packEnabledItems.length) return 'enabled_loader_skipped_pack_items';
  if (!state.matches.length) return 'matching_failed';
  if (!state.route || state.route.type === 'no_match' || state.route.confidence === 'none') return 'routing_failed';
  return '';
}

module.exports = {
  diagnoseApprovedKnowledgePipeline
};
