const express = require('express');

const {
  getDraftPackReport,
  getTeacherContentDashboard,
  listUploadedSourceHistory,
  listApprovedPacksSummary,
  listDraftPacksForReview
} = require('../lib/uploads/teacherContentAdapter');
const { setApprovedPackActivation } = require('../lib/knowledge/approvedPackActivationStore');
const {
  deleteApprovedKnowledgePack,
  deleteApprovedKnowledgePacks
} = require('../lib/knowledge/deleteApprovedKnowledgePack');
const {
  archiveAcceptedDraftKnowledgePack,
  archiveDraftKnowledgePackFromReviewQueue
} = require('../lib/knowledge/archiveAcceptedDraftKnowledgePack');
const { approveCombinedReviewRows } = require('../lib/knowledge/approveCombinedReviewRows');
const { promoteDraftKnowledgePack } = require('../lib/knowledge/promoteDraftKnowledgePack');
const {
  REVIEWABLE_SECTIONS,
  SAFE_EDIT_FIELDS
} = require('../lib/knowledge/reviewDraftKnowledgePack');
const { REVIEW_STATUSES } = require('../lib/knowledge/packSchema');
const { buildImportEstimate } = require('../lib/uploads/generateDraftKnowledgePack');
const { planTeacherContentImport } = require('../lib/uploads/planTeacherContentImport');
const {
  getStandardsBankDetails,
  listStandardsBanks,
  loadStandardsBankForReport
} = require('../lib/standards/standardsBankDiscovery');
const {
  DEFAULT_UPLOAD_LIMIT_BYTES,
  getExtractionJsonPathForUpload,
  readSingleMultipartUpload,
  storeAndExtractUpload
} = require('../lib/uploads/uploadStorage');
const {
  buildExtractionTimeline,
  makeAutoAnalyzeGenerationOptions,
  makeTimelineEvent,
  prepareReviewDraftFromUpload
} = require('../lib/uploads/prepareReviewDraftService');
const {
  buildPromotionDebugPayload,
  editDraftItemFieldForRoute,
  extractDraftItemRef,
  readDraftItemSnapshot,
  resolveDraftItemMutationTarget,
  sendDraftMutationResponse,
  updateDraftItemStatusForRoute,
  validateDraftItemRouteParams
} = require('../lib/knowledge/draftItemMutationService');
const {
  editApprovedKnowledgePackItem,
  loadApprovedKnowledgePackForEdit,
  normalizeApprovedItemEdits
} = require('../lib/knowledge/approvedPackEditService');
const {
  firstError,
  getKnowledgeNameFromFields,
  isSafePackId,
  isSafeUploadId,
  joinMessages,
  makeRouteErrorPayload,
  readJsonFile,
  sendJson,
  sendRouteError,
  stripStatusCode
} = require('../lib/server/routeResponse');

function createTeacherContentRoutes(options = {}) {
  const router = express.Router();
  registerTeacherContentRoutes(router, options);
  return router;
}

function registerTeacherContentRoutes(app, options = {}) {
  app.get('/dashboard', (_req, res) => {
    sendJson(res, () => getTeacherContentDashboard(options));
  });

  app.get('/drafts', (_req, res) => {
    sendJson(res, () => listDraftPacksForReview(options));
  });

  app.get('/uploads/history', (_req, res) => {
    sendJson(res, () => listUploadedSourceHistory(options));
  });

  app.get('/standards-banks', (_req, res) => {
    sendJson(res, () => listStandardsBanks(options));
  });

  app.get('/standards-banks/:standardsBankId', (req, res) => {
    const standardsBankId = String(req.params && req.params.standardsBankId || '').trim();
    const result = getStandardsBankDetails(standardsBankId, options);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        errors: result.errors || ['Standards bank could not be loaded.'],
        warnings: result.warnings || []
      });
    }

    return res.json({
      success: true,
      data: result.standardsBank
    });
  });

  app.post('/uploads/extract', async (req, res) => {
    try {
      const upload = await readSingleMultipartUpload(req, {
        maxBytes: Number(options.maxUploadBytes || DEFAULT_UPLOAD_LIMIT_BYTES)
      });
      const result = await storeAndExtractUpload(upload, options);
      const statusCode = result.success ? 200 : 400;
      return res.status(statusCode).json(result);
    } catch (error) {
      return res.status(error.statusCode || 400).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.post('/uploads/upload-and-prepare', async (req, res) => {
    try {
      const upload = await readSingleMultipartUpload(req, {
        maxBytes: Number(options.maxUploadBytes || DEFAULT_UPLOAD_LIMIT_BYTES)
      });
      const knowledgeName = getKnowledgeNameFromFields(upload.fields);
      if (!knowledgeName) {
        return res.status(400).json(makeRouteErrorPayload('Knowledge name is required.'));
      }

      const extractionResult = await storeAndExtractUpload(upload, options);
      if (!extractionResult.success) {
        return res.status(400).json({
          ok: false,
          error: firstError(extractionResult.errors, 'Extraction failed.'),
          details: joinMessages(extractionResult.errors),
          ...extractionResult,
          data: {
            upload: extractionResult.data || null,
            extraction: extractionResult.data || null
          }
        });
      }

      const uploadData = extractionResult.data || {};
      const extractionTimeline = buildExtractionTimeline(uploadData);
      const extractionJsonPath = getExtractionJsonPathForUpload(uploadData.uploadId, options);
      const extraction = readJsonFile(extractionJsonPath, 'extraction JSON').value || null;
      const autoAnalyzeOptions = makeAutoAnalyzeGenerationOptions({
        ...options
      });
      const importEstimate = buildImportEstimate(extraction, autoAnalyzeOptions);
      const autoImportPlan = planTeacherContentImport({
        extraction,
        fileSizeBytes: upload.buffer.length,
        settings: autoAnalyzeOptions,
        memory: options.systemMemory
      });

      return res.json({
        success: true,
        data: {
          upload: uploadData,
          extraction: uploadData,
          importEstimate,
          autoImportPlan,
          requiresPreview: autoImportPlan.recommendedImportScope !== 'full_document',
          nextStep: autoImportPlan.recommendedImportScope === 'full_document' ? 'generate_draft' : 'run_preview',
          message: 'Upload extracted. Analysis will use conservative local-model batches.',
          timeline: [
            ...extractionTimeline,
            makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate),
            makeTimelineEvent('auto_import_plan_ready', 'Auto import plan ready', autoImportPlan)
          ]
        },
        errors: [],
        warnings: [...(extractionResult.warnings || []), ...(autoImportPlan.warnings || [])]
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json(makeRouteErrorPayload(error instanceof Error ? error.message : String(error)));
    }
  });

  app.post('/uploads/:uploadId/prepare-review', async (req, res) => {
    const uploadId = String(req.params && req.params.uploadId || '').trim();
    if (!isSafeUploadId(uploadId)) {
      return res.status(400).json({
        success: false,
        errors: ['uploadId must contain only lowercase letters, numbers, underscores, and hyphens.'],
        warnings: []
      });
    }

    try {
      const result = await prepareReviewDraftFromUpload(uploadId, req.body || {}, options);
      if (!result.success) {
        return res.status(result.statusCode || 400).json(stripStatusCode(result));
      }
      return res.json(result);
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/drafts/:packId/report', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const reportOptions = { ...options };
      const standardsBankId = String(req.query && req.query.standardsBankId || '').trim();
      if (standardsBankId) {
        const bankResult = loadStandardsBankForReport(standardsBankId, options);
        if (!bankResult.success) {
          return res.status(bankResult.statusCode || 400).json({
            success: false,
            errors: bankResult.errors || ['Standards bank could not be loaded.'],
            warnings: bankResult.warnings || []
          });
        }
        reportOptions.standardsBank = bankResult.standardsBank;
        reportOptions.standardsBankSummary = bankResult.summary;
      }

      const report = getDraftPackReport(packId, reportOptions);
      if (!report.success) {
        return res.status(404).json({
          success: false,
          errors: report.errors || ['Draft pack not found.']
        });
      }

      return res.json({
        success: true,
        data: report
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.patch('/drafts/:packId/items/:section/:index/status', (req, res) => {
    const validation = validateDraftItemRouteParams(req.params);
    if (!validation.success) {
      return res.status(400).json(validation);
    }

    const reviewStatus = req.body && req.body.reviewStatus;
    if (!REVIEW_STATUSES.includes(reviewStatus)) {
      return res.status(400).json({
        success: false,
        errors: [`reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`]
      });
    }

    try {
      const debugContext = req.body && typeof req.body.debugContext === 'object' && !Array.isArray(req.body.debugContext)
        ? req.body.debugContext
        : {};
      const itemRef = extractDraftItemRef(req.body && req.body.itemRef);
      const target = resolveDraftItemMutationTarget({
        packId: validation.packId,
        section: validation.section,
        requestedIndex: validation.index,
        itemRef,
        options
      });
      if (!target.success) {
        return res.status(target.statusCode || 409).json({
          success: false,
          errors: target.errors || ['Draft item target could not be resolved.'],
          warnings: target.warnings || [],
          debug: {
            routeHandler: 'PATCH /drafts/:packId/items/:section/:index/status',
            request: {
              packId: validation.packId,
              section: validation.section,
              requestedIndex: validation.index,
              reviewStatus,
              itemRef,
              debugContext
            },
            resolvedTarget: target
          }
        });
      }
      const beforeSnapshot = readDraftItemSnapshot(validation.packId, validation.section, target.index, options);
      const edits = Array.isArray(req.body && req.body.edits)
        ? req.body.edits
        : [];
      const update = updateDraftItemStatusForRoute({
        packId: validation.packId,
        section: validation.section,
        index: target.index,
        reviewStatus,
        edits,
        options
      });
      const afterSnapshot = readDraftItemSnapshot(validation.packId, validation.section, target.index, options);
      return sendDraftMutationResponse(res, update, validation.packId, options, {
        routeHandler: 'PATCH /drafts/:packId/items/:section/:index/status',
        request: {
          packId: validation.packId,
          section: validation.section,
          index: target.index,
          requestedIndex: validation.index,
          reviewStatus,
          edits,
          itemRef,
          resolvedTarget: target,
          debugContext
        },
        beforeSnapshot,
        afterSnapshot
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.patch('/drafts/:packId/items/:section/:index', (req, res) => {
    const validation = validateDraftItemRouteParams(req.params);
    if (!validation.success) {
      return res.status(400).json(validation);
    }

    const field = String(req.body && req.body.field || '').trim();
    const allowedFields = SAFE_EDIT_FIELDS[validation.section] || new Set();
    if (!allowedFields.has(field)) {
      return res.status(400).json({
        success: false,
        errors: [`Field ${validation.section}.${field || '(empty)'} is not editable through draft review.`]
      });
    }

    try {
      const debugContext = req.body && typeof req.body.debugContext === 'object' && !Array.isArray(req.body.debugContext)
        ? req.body.debugContext
        : {};
      const itemRef = extractDraftItemRef(req.body && req.body.itemRef);
      const target = resolveDraftItemMutationTarget({
        packId: validation.packId,
        section: validation.section,
        requestedIndex: validation.index,
        itemRef,
        options
      });
      if (!target.success) {
        return res.status(target.statusCode || 409).json({
          success: false,
          errors: target.errors || ['Draft item target could not be resolved.'],
          warnings: target.warnings || [],
          debug: {
            routeHandler: 'PATCH /drafts/:packId/items/:section/:index',
            request: {
              packId: validation.packId,
              section: validation.section,
              requestedIndex: validation.index,
              field,
              value: req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '',
              itemRef,
              debugContext
            },
            resolvedTarget: target
          }
        });
      }
      const beforeSnapshot = readDraftItemSnapshot(validation.packId, validation.section, target.index, options);
      const value = req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '';
      const update = editDraftItemFieldForRoute({
        packId: validation.packId,
        section: validation.section,
        index: target.index,
        field,
        value,
        options
      });
      const afterSnapshot = readDraftItemSnapshot(validation.packId, validation.section, target.index, options);
      return sendDraftMutationResponse(res, update, validation.packId, options, {
        routeHandler: 'PATCH /drafts/:packId/items/:section/:index',
        request: {
          packId: validation.packId,
          section: validation.section,
          index: target.index,
          requestedIndex: validation.index,
          field,
          value,
          itemRef,
          resolvedTarget: target,
          debugContext
        },
        beforeSnapshot,
        afterSnapshot
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/drafts/:packId/promote', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const promotion = promoteDraftKnowledgePack(packId, {
        ...options,
        force: req.body && req.body.force === true,
        promotionMode: req.body && (req.body.promotionMode || req.body.mode),
        selectedItems: req.body && (req.body.selectedItems || req.body.selectedRows)
      });

      if (!promotion.success) {
        const report = getDraftPackReport(packId, options);
        const missingDraft = (promotion.errors || []).some((error) => String(error).includes('No draft knowledge pack found'));
        return res.status(missingDraft ? 404 : 400).json({
          success: false,
          message: report && report.promotionReadiness && report.promotionReadiness.blockerSummary && report.promotionReadiness.blockerSummary.message
            ? report.promotionReadiness.blockerSummary.message
            : 'Draft promotion failed.',
          errors: promotion.errors || ['Draft promotion failed.'],
          warnings: promotion.warnings || [],
          promotionReadiness: report && report.promotionReadiness ? report.promotionReadiness : undefined,
          debug: buildPromotionDebugPayload(packId, options, report, promotion)
        });
      }

      const approvedSummary = listApprovedPacksSummary(options);
      const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === promotion.packId) || null;
      let archivedDraft = null;
      const archiveWarnings = [];
      try {
        archivedDraft = archiveAcceptedDraftKnowledgePack(packId, options);
      } catch (archiveError) {
        archiveWarnings.push(`Approved pack was created, but the active draft copy could not be archived: ${archiveError instanceof Error ? archiveError.message : String(archiveError)}`);
      }
      const dashboard = getTeacherContentDashboard(options);
      const drafts = listDraftPacksForReview(options);

      return res.json({
        success: true,
        data: {
          packId: promotion.packId,
          message: 'Saved and enabled for student answers.',
          outputPath: promotion.outputPath,
          activation: promotion.activation || null,
          approved,
          archivedDraft,
          dashboard,
          drafts: drafts.draftPacks,
          report: null,
          approvedSummary,
          debug: buildPromotionDebugPayload(packId, options, null, {
            ...promotion,
            archivedDraft
          })
        },
        warnings: [...(promotion.warnings || []), ...archiveWarnings],
        errors: []
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.post('/review/approve-combined', (req, res) => {
    try {
      const approval = approveCombinedReviewRows({
        mode: req.body && req.body.mode,
        draftPackId: req.body && (req.body.draftPackId || req.body.packId),
        reviewBatchName: req.body && (req.body.reviewBatchName || req.body.batchName || req.body.knowledgeName),
        reviewBatchPackIds: req.body && (req.body.reviewBatchPackIds || req.body.queuePackIds || req.body.packIds),
        rows: req.body && (req.body.rows || req.body.items || req.body.selectedItems || req.body.selectedRows)
      }, options);

      if (!approval.success) {
        return res.status(400).json({
          success: false,
          errors: approval.errors || ['No valid rows could be approved.'],
          warnings: approval.warnings || [],
          skipped: approval.skipped || undefined
        });
      }

      const dashboard = getTeacherContentDashboard(options);
      const drafts = listDraftPacksForReview(options);
      const approvedSummary = listApprovedPacksSummary(options);
      const reportsByPackId = {};
      const refreshedPackIds = Array.from(new Set([
        ...(Array.isArray(approval.updatedDraftPackIds) ? approval.updatedDraftPackIds : []),
        ...(Array.isArray(req.body && req.body.reviewBatchPackIds) ? req.body.reviewBatchPackIds : []),
        String(req.body && (req.body.draftPackId || req.body.packId) || '').trim()
      ].map((candidatePackId) => String(candidatePackId || '').trim()).filter((candidatePackId) => isSafePackId(candidatePackId))));
      refreshedPackIds.forEach((candidatePackId) => {
        const report = getDraftPackReport(candidatePackId, options);
        if (report && report.success) reportsByPackId[candidatePackId] = report;
      });

      return res.json({
        success: true,
        data: {
          mode: approval.mode,
          acceptedCount: approval.acceptedCount,
          skipped: approval.skipped,
          combinedPack: approval.combinedPack,
          activation: approval.activation || null,
          finalPublish: approval.finalPublish === true,
          draftPackId: approval.draftPackId || null,
          archivedDrafts: approval.archivedDrafts || [],
          updatedDraftPackIds: approval.updatedDraftPackIds || [],
          message: 'Saved and enabled for student answers.',
          dashboard,
          drafts: drafts.draftPacks,
          draftSummary: drafts,
          approvedSummary,
          reportsByPackId
        },
        errors: [],
        warnings: approval.warnings || []
      });
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.delete('/drafts/:packId/accepted-copy', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const archivedDraft = archiveAcceptedDraftKnowledgePack(packId, options);
      const dashboard = getTeacherContentDashboard(options);
      const drafts = listDraftPacksForReview(options);
      const approvedSummary = listApprovedPacksSummary(options);
      return res.json({
        success: true,
        data: {
          ...archivedDraft,
          message: archivedDraft.alreadyArchived
            ? 'Accepted draft copy was already removed from active drafts. Approved pack was preserved.'
            : 'Accepted draft copy archived from active drafts. Approved pack was preserved.',
          dashboard,
          drafts: drafts.draftPacks,
          approvedSummary
        },
        warnings: [],
        errors: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.delete('/drafts/:packId/review-queue', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const archivedDraft = archiveDraftKnowledgePackFromReviewQueue(packId, options);
      const dashboard = getTeacherContentDashboard(options);
      const drafts = listDraftPacksForReview(options);
      const approvedSummary = listApprovedPacksSummary(options);
      return res.json({
        success: true,
        data: {
          ...archivedDraft,
          message: archivedDraft.alreadyArchived
            ? 'Draft was already removed from the active review queue.'
            : 'Draft removed from the active review queue.',
          dashboard,
          drafts: drafts.draftPacks,
          approvedSummary
        },
        warnings: [],
        errors: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.get('/approved', (_req, res) => {
    sendJson(res, () => listApprovedPacksSummary(options));
  });

  app.get('/approved/:packId', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    const loadResult = loadApprovedKnowledgePackForEdit(packId, options);
    if (!loadResult.success) {
      return res.status(loadResult.statusCode || 404).json({
        success: false,
        errors: loadResult.errors || ['Approved knowledge pack not found.']
      });
    }

    const approvedSummary = listApprovedPacksSummary(options);
    const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === packId) || null;
    return res.json({
      success: true,
      data: {
        pack: loadResult.pack,
        approved,
        approvedSummary
      },
      errors: [],
      warnings: loadResult.warnings || []
    });
  });

  app.delete('/approved', (req, res) => {
    const packIds = Array.isArray(req.body && req.body.packIds) ? req.body.packIds : [];
    const invalidPackId = packIds.map((packId) => String(packId || '').trim()).find((packId) => !isSafePackId(packId));
    if (invalidPackId || !packIds.length) {
      return res.status(400).json({
        success: false,
        errors: [packIds.length ? 'packIds must contain only lowercase letters, numbers, underscores, and hyphens.' : 'packIds must include at least one visible knowledge pack ID.']
      });
    }

    const confirmed = req.body && req.body.confirmed === true;
    const confirmationText = String(req.body && req.body.confirmationText || '').trim();
    if (!confirmed && !confirmationText) {
      return res.status(400).json({
        success: false,
        errors: ['confirmed must be true before deleting visible knowledge packs.']
      });
    }

    try {
      const deletion = deleteApprovedKnowledgePacks(packIds, {
        ...options,
        confirmed,
        confirmationText
      });
      const approvedSummary = listApprovedPacksSummary(options);
      return res.json({
        success: true,
        data: {
          ...deletion,
          message: 'Selected knowledge packs deleted from saved teacher-content locations.',
          approvedSummary
        },
        errors: [],
        warnings: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.patch('/approved/:packId/activation', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    if (!req.body || typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        errors: ['enabled must be a boolean.']
      });
    }

    try {
      const activation = setApprovedPackActivation(packId, req.body.enabled, options);
      const approvedSummary = listApprovedPacksSummary(options);
      const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === packId) || null;

      return res.json({
        success: true,
        data: {
          packId,
          activationEnabled: activation.activationEnabled,
          activationStatus: activation.activationStatus,
          activationUpdatedAt: activation.activationUpdatedAt,
          message: activation.activationEnabled
            ? 'Enabled for student answers.'
            : 'Disabled for student answers.',
          approved,
          approvedSummary
        },
        errors: [],
        warnings: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.patch('/approved/:packId/items/:section/:index', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    const section = String(req.params && req.params.section || '').trim();
    if (!REVIEWABLE_SECTIONS.includes(section)) {
      return res.status(400).json({
        success: false,
        errors: [`section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`]
      });
    }

    const index = Number(req.params && req.params.index);
    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({
        success: false,
        errors: [`index must be a non-negative integer for ${section}.`]
      });
    }

    const edits = Array.isArray(req.body && req.body.edits) ? req.body.edits : [];
    const normalizedEdits = normalizeApprovedItemEdits(section, edits);
    if (!normalizedEdits.success) {
      return res.status(400).json({
        success: false,
        errors: normalizedEdits.errors
      });
    }

    try {
      const update = editApprovedKnowledgePackItem(packId, section, index, normalizedEdits.edits, options);
      if (!update.success) {
        return res.status(update.statusCode || 400).json({
          success: false,
          errors: update.errors || ['Approved knowledge item could not be saved.'],
          warnings: update.warnings || []
        });
      }

      const approvedSummary = listApprovedPacksSummary(options);
      const approved = approvedSummary.approvedPacks.find((pack) => pack.packId === packId) || null;
      const remainsEnabled = approved && approved.activationEnabled === true;
      return res.json({
        success: true,
        data: {
          packId,
          section,
          index,
          pack: update.pack,
          item: update.item,
          changedFields: normalizedEdits.edits.map((edit) => edit.field),
          approved,
          approvedSummary,
          activationEnabled: remainsEnabled,
          message: remainsEnabled
            ? 'Saved changes to approved knowledge. This pack remains enabled for student answers.'
            : 'Saved changes to approved knowledge.'
        },
        errors: [],
        warnings: update.warnings || []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });

  app.delete('/approved/:packId', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    const confirmed = req.body && req.body.confirmed === true;
    const confirmationText = String(req.body && req.body.confirmationText || '').trim();
    if (!confirmed && !confirmationText) {
      return res.status(400).json({
        success: false,
        errors: ['confirmed must be true before deleting a visible knowledge pack.']
      });
    }

    try {
      const deletion = deleteApprovedKnowledgePack(packId, {
        ...options,
        confirmed,
        confirmationText
      });
      if (!deletion.success) {
        return res.status(404).json({
          success: false,
          deleted: deletion.deleted || [],
          notFound: deletion.notFound || [packId],
          errors: deletion.errors && deletion.errors.length ? deletion.errors : ['No matching saved knowledge pack was deleted.']
        });
      }
      const approvedSummary = listApprovedPacksSummary(options);
      return res.json({
        success: true,
        deleted: deletion.deleted || [],
        notFound: deletion.notFound || [],
        errors: deletion.errors || [],
        data: {
          ...deletion,
          message: 'Deleted pack from saved knowledge.',
          approvedSummary
        },
        warnings: []
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        deleted: [],
        notFound: [packId],
        errors: [error instanceof Error ? error.message : String(error)]
      });
    }
  });
}

module.exports = {
  createTeacherContentRoutes,
  getExtractionJsonPathForUpload,
  isSafePackId,
  isSafeUploadId,
  prepareReviewDraftFromUpload,
  registerTeacherContentRoutes,
  storeAndExtractUpload
};
