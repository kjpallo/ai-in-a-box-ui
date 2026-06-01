const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

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
  SAFE_EDIT_FIELDS,
  applyDraftItemReviewDecision,
  editDraftItemField,
  updateDraftItemReviewStatus
} = require('../lib/knowledge/reviewDraftKnowledgePack');
const { DEFAULT_DRAFT_PACKS_DIR } = require('../lib/knowledge/loadDraftKnowledgePacks');
const { REVIEW_STATUSES } = require('../lib/knowledge/packSchema');
const { detectUploadFileType, supportedExtensions } = require('../lib/uploads/detectUploadFileType');
const { extractTextFromFile } = require('../lib/uploads/extractTextFromFile');
const { makeSourceManifestFromExtraction } = require('../lib/uploads/sourceManifest');
const {
  buildImportEstimate,
  generateDraftKnowledgePack,
  identifyTextBearingPages,
  isModelCrashMessage,
  isModelTimeoutMessage
} = require('../lib/uploads/generateDraftKnowledgePack');
const { planTeacherContentImport } = require('../lib/uploads/planTeacherContentImport');
const {
  getStandardsBankDetails,
  listStandardsBanks,
  loadStandardsBankForReport
} = require('../lib/standards/standardsBankDiscovery');

const SAFE_PACK_ID_PATTERN = /^[a-z0-9_-]+$/;
const SAFE_UPLOAD_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const IMPORT_PROFILE_VALUES = new Set([
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
]);
const DEFAULT_UPLOAD_LIMIT_BYTES = 15 * 1024 * 1024;
const DEFAULT_PREVIEW_SELECTED_GENERATION_TIMEOUT_MS = 120000;
const DEFAULT_FULL_GENERATION_TIMEOUT_MS = 300000;
const AUTO_ANALYZE_MAX_BATCH_CHARACTERS = 400;
const AUTO_ANALYZE_RETRY_MAX_BATCH_CHARACTERS = 200;
const AUTO_ANALYZE_TIMEOUT_MS = 120000;

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
      const update = edits.length > 0
        ? applyDraftItemReviewDecision(
          validation.packId,
          validation.section,
          target.index,
          {
            reviewStatus,
            edits
          },
          options
        )
        : updateDraftItemReviewStatus(
          validation.packId,
          validation.section,
          target.index,
          reviewStatus,
          options
        );
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
      const update = editDraftItemField(
        validation.packId,
        validation.section,
        target.index,
        field,
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '',
        options
      );
      const afterSnapshot = readDraftItemSnapshot(validation.packId, validation.section, target.index, options);
      return sendDraftMutationResponse(res, update, validation.packId, options, {
        routeHandler: 'PATCH /drafts/:packId/items/:section/:index',
        request: {
          packId: validation.packId,
          section: validation.section,
          index: target.index,
          requestedIndex: validation.index,
          field,
          value: req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '',
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
          message: 'Draft promoted to approved knowledge pack.',
          outputPath: promotion.outputPath,
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
      ].map((packId) => String(packId || '').trim()).filter((packId) => isSafePackId(packId))));
      refreshedPackIds.forEach((packId) => {
        const report = getDraftPackReport(packId, options);
        if (report && report.success) reportsByPackId[packId] = report;
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
          message: 'Activation setting saved. This does not change student answers yet.',
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

async function storeAndExtractUpload(upload, options = {}) {
  const originalFileName = sanitizeOriginalFileName(upload.originalFileName);
  if (!originalFileName) {
    return {
      success: false,
      errors: ['Uploaded file must include a filename.']
    };
  }

  const detection = detectUploadFileType(originalFileName, { buffer: upload.buffer });
  if (!detection.supported) {
    return {
      success: false,
      errors: detection.errors || [`Unsupported upload file type. Supported types: ${supportedExtensions().join(', ')}.`]
    };
  }

  const uploadId = makeUploadId();
  const incomingDir = getUploadIncomingDir(options);
  const extractedDir = getUploadExtractedDir(options);
  fs.mkdirSync(incomingDir, { recursive: true });
  fs.mkdirSync(extractedDir, { recursive: true });

  const storedFileName = `${uploadId}${detection.extension}`;
  const extractionJsonFileName = `${uploadId}_extraction.json`;
  const storedFilePath = path.join(incomingDir, storedFileName);
  const extractionJsonPath = path.join(extractedDir, extractionJsonFileName);

  fs.writeFileSync(storedFilePath, upload.buffer);

  const extraction = await extractTextFromFile(storedFilePath);
  const extractionWithOriginalSource = {
    ...extraction,
    sections: Array.isArray(extraction.sections)
      ? extraction.sections.map((section) => ({
          ...section,
          sourceFile: firstNonEmptyString(originalFileName, section && section.sourceFile)
        }))
      : [],
    pages: Array.isArray(extraction.pages)
      ? extraction.pages.map((page) => ({
          ...page,
          sourceFile: firstNonEmptyString(originalFileName, page && page.sourceFile)
        }))
      : [],
    metadata: {
      ...(extraction.metadata || {}),
      originalFileName
    }
  };
  const extractionWarnings = [
    ...(detection.warnings || []),
    ...(extraction.warnings || [])
  ];
  const autoImportPlan = planTeacherContentImport({
    extraction: extractionWithOriginalSource,
    fileSizeBytes: upload.buffer.length,
    settings: options,
    memory: options.systemMemory
  });
  const sourceManifest = makeSourceManifestFromExtraction(extractionWithOriginalSource);
  const extractionWithUploadMetadata = {
    ...extractionWithOriginalSource,
    upload: {
      uploadId,
      originalFileName,
      storedFileName,
      extractionJsonFileName
    },
    sourceManifest,
    importPlan: autoImportPlan,
    warnings: extractionWarnings
  };
  fs.writeFileSync(extractionJsonPath, `${JSON.stringify(extractionWithUploadMetadata, null, 2)}\n`);

  const response = {
    success: extraction.success === true,
    data: {
      uploadId,
      originalFileName,
      storedFileName,
      extractionJsonFileName,
      fileType: detection.type,
      characterCount: extractionWithOriginalSource.text.length,
      pageCount: Number(extractionWithOriginalSource.metadata && extractionWithOriginalSource.metadata.pageCount || 0),
      sectionsCount: extractionWithOriginalSource.sections.length,
      tablesCount: extractionWithOriginalSource.tables.length,
      sourceManifest,
      warnings: extractionWarnings,
      errors: extraction.errors || [],
      extraction: makeExtractionSummary(extractionWithUploadMetadata),
      autoImportPlan
    },
    warnings: [...extractionWarnings, ...(autoImportPlan.warnings || [])],
    errors: extraction.errors || []
  };

  if (!response.success) {
    return {
      success: false,
      errors: response.errors,
      warnings: response.warnings,
      data: response.data
    };
  }

  return response;
}

function getUploadIncomingDir(options = {}) {
  return options.uploadIncomingDir
    || path.join(__dirname, '..', 'knowledge', 'uploads', 'incoming');
}

function getUploadExtractedDir(options = {}) {
  return options.uploadExtractedDir
    || path.join(__dirname, '..', 'knowledge', 'uploads', 'extracted');
}

async function prepareReviewDraftFromUpload(uploadId, body = {}, options = {}) {
  if (nonEmptyString(options.rawModelResponsesDir)) {
    fs.mkdirSync(path.resolve(options.rawModelResponsesDir), { recursive: true });
  }
  const extractionJsonPath = getExtractionJsonPathForUpload(uploadId, options);
  if (!fs.existsSync(extractionJsonPath)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 404,
      errors: ['No extracted upload JSON was found for this uploadId. Extract text before preparing review.'],
      warnings: []
    }, { uploadId, body });
  }
  const extraction = readJsonFile(extractionJsonPath, 'extraction JSON').value || null;
  const generationOptions = {
    ...options,
    maxBatchCharacters: positiveNumberOrUndefined(body.maxBatchCharacters) || options.maxBatchCharacters,
    retryMaxBatchCharacters: positiveNumberOrUndefined(body.retryMaxBatchCharacters) || options.retryMaxBatchCharacters,
    maxBatchChunks: positiveNumberOrUndefined(body.maxBatchChunks) || options.maxBatchChunks,
    previewMaxPages: positiveNumberOrUndefined(body.previewMaxPages) || options.previewMaxPages,
    previewMaxCharacters: positiveNumberOrUndefined(body.previewMaxCharacters) || positiveNumberOrUndefined(body.maxPreviewChars) || options.previewMaxCharacters,
    previewMode: nonEmptyString(body.previewMode) ? body.previewMode.trim() : nonEmptyString(body.previewSize) ? body.previewSize.trim() : options.previewMode
  };
  const autoRecommendationAccepted = body.useAutoImportPlan === true || body.useRecommendedImportPlan === true;
  const effectiveGenerationOptions = autoRecommendationAccepted
    ? makeAutoAnalyzeGenerationOptions(generationOptions)
    : generationOptions;
  const importEstimate = buildImportEstimate(extraction, effectiveGenerationOptions);
  const autoImportPlan = extraction && extraction.importPlan
    ? extraction.importPlan
    : planTeacherContentImport({
      extraction,
      settings: effectiveGenerationOptions,
      memory: options.systemMemory
    });
  let importMode = String(body.importMode || body.mode || '').trim().toLowerCase();
  if (!importMode && autoRecommendationAccepted) {
    importMode = resolveAutoImportMode(autoImportPlan);
  }
  const previewOnly = importMode === 'preview' || body.preview === true;
  const fullImportRequested = importMode === 'full' || body.fullImport === true;
  const selectedImportRequested = importMode === 'selected' || importMode === 'range' || body.selectedImport === true;
  const confirmedFullImport = body.confirmFullImportText === 'CONFIRM'
    || body.fullImportConfirmation === 'CONFIRM'
    || body.confirmationText === 'CONFIRM'
    || (body.confirmFullImport === true && !importEstimate.isLarge)
    || (body.confirmedFullImport === true && !importEstimate.isLarge);

  if (!previewOnly && !fullImportRequested && !selectedImportRequested) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 409,
      errors: ['Select Analyze Upload or choose a specific import action before preparing the review draft.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection: null, importEstimate });
  }

  if (fullImportRequested && importEstimate.fullImportRequiresConfirmation && importEstimate.isLarge && !confirmedFullImport && !autoRecommendationAccepted) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 409,
      errors: ['Whole-packet full import requires typing CONFIRM. For large packets, import one section at a time to avoid overloading local Gemma.'],
      warnings: importEstimate.largeReasons || [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('import_estimate_ready', 'Import estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection: null, importEstimate });
  }

  const routeImportSelection = makeRouteImportSelection(body);
  const autoImportSelection = autoRecommendationAccepted ? makeAutoImportSelection(autoImportPlan, importEstimate) : null;
  const importSelection = (selectedImportRequested || previewOnly)
    ? (hasUsableImportSelection(routeImportSelection) ? routeImportSelection : autoImportSelection)
    : null;
  if (previewOnly && !hasUsableImportSelection(importSelection)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 400,
      errors: ['Preview prepare requires selected pages or chunks. Send importSelection.pageStart/pageEnd or importSelection.chunkStart/chunkEnd.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('full_import_estimate_ready', 'Full upload estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }
  if (selectedImportRequested && !hasUsableImportSelection(importSelection)) {
    return makePrepareReviewFailurePayload({
      success: false,
      statusCode: 400,
      errors: ['Selected import requires selected pages or chunks. Send importSelection.pageStart/pageEnd or importSelection.chunkStart/chunkEnd.'],
      warnings: [],
      importEstimate,
      autoImportPlan,
      timeline: [makeTimelineEvent('full_import_estimate_ready', 'Full upload estimate ready', importEstimate)]
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }
  const selectionLabel = selectedImportRequested ? makeRouteImportSelectionLabel(importSelection) : '';
  const packName = getKnowledgeNameFromFields(body) || (nonEmptyString(body.packName) ? body.packName.trim() : undefined);
  const importIntent = nonEmptyString(body.importIntent)
    ? body.importIntent.trim()
    : nonEmptyString(body.selectedImportPreset)
      ? body.selectedImportPreset.trim()
      : '';
  const scopedPackName = makeScopedRoutePackName(packName, {
    previewOnly,
    selectedImportRequested,
    importIntent,
    selectionLabel,
    importEstimate
  });

  const generation = await generateDraftKnowledgePack({
    extractionJsonPath,
    outputDraftDir: options.draftPacksDir,
    draftPacksDir: options.draftPacksDir,
    standardsBank: options.standardsBank,
    standardsBankPath: sanitizeStandardsBankPath(body.standardsBankPath, options),
    model: nonEmptyString(body.model) ? body.model.trim() : undefined,
    timeoutMs: resolvePrepareReviewGenerationTimeoutMs({
      body,
      options,
      previewOnly,
      selectedImportRequested,
      fullImportRequested,
      autoRecommendationAccepted
    }),
    keepAlive: nonEmptyString(body.keepAlive) ? body.keepAlive.trim() : undefined,
    retryInvalidJson: body.retryInvalidJson === true,
    packName: scopedPackName,
    modelClient: options.modelClient || options.draftModelClient,
    rawModelResponsesDir: options.rawModelResponsesDir,
    maxBatchCharacters: effectiveGenerationOptions.maxBatchCharacters,
    retryMaxBatchCharacters: effectiveGenerationOptions.retryMaxBatchCharacters,
    previewMaxPages: generationOptions.previewMaxPages,
    previewMaxCharacters: generationOptions.previewMaxCharacters,
    previewMode: generationOptions.previewMode,
    maxBatchChunks: autoRecommendationAccepted || (previewOnly && String(generationOptions.previewMode || '').toLowerCase().includes('ultra')) ? 1 : effectiveGenerationOptions.maxBatchChunks,
    previewOnly,
    importMode: selectedImportRequested ? 'selected' : importMode,
    importProfile: normalizeImportProfile(body.importProfile),
    importIntent,
    importSelection,
    autoImportPlan,
    adaptiveImportLoop: autoRecommendationAccepted === true && !previewOnly && !selectedImportRequested
  });

  if (!generation.success) {
    const teacherFriendlyError = isModelTimeoutGenerationFailure(generation)
      ? 'Local Gemma took too long while reading this batch.'
      : isModelCrashGenerationFailure(generation)
      ? 'Local Gemma crashed while reading this batch.'
      : previewOnly && isNoUsablePreviewFailure(generation)
      ? 'Gemma did not return any usable preview items from this range.'
      : firstError(generation.errors, 'Review draft preparation failed.');
    const technicalErrors = (generation.errors || []).filter((error) => error !== teacherFriendlyError);
    return makePrepareReviewFailurePayload({
      success: false,
      errors: generation.errors || ['Review draft preparation failed.'],
      teacherFriendlyError,
      technicalErrors,
      warnings: generation.warnings || [],
      validationErrors: generation.validationErrors || generation.errors || [],
      invalidItems: generation.invalidItems || [],
      repairNeeded: generation.repairNeeded || generation.invalidItems || [],
      autoImportPlan,
      importEstimate,
      selectedImportEstimate: generation.selectedImportEstimate,
      importSelection: generation.importSelection || importSelection,
      rawModelResponsePath: generation.rawModelResponsePath,
      timeline: generation.timeline || [],
      coverageReport: generation.coverageReport,
      failedBatches: generation.failedBatches || [],
      modelTimeout: generation.modelTimeout === true,
      modelCrash: generation.modelCrash === true
    }, { uploadId, body, extraction, importSelection, importEstimate });
  }

  if (previewOnly) {
    return {
      success: true,
      data: {
        preview: true,
        partialPreview: generation.partialPreview === true,
        validationPassed: generation.validationPassed === true,
        message: generation.previewReport && generation.previewReport.message
          ? generation.previewReport.message
          : generation.partialPreview
            ? 'Partial preview created. Some pages/chunks failed.'
            : 'Preview draft prepared. Review the sample before running full import.',
        importEstimate,
        autoImportPlan,
        importSelection: generation.importSelection,
        importScope: generation.importScope,
        selectedImportEstimate: generation.selectedImportEstimate,
        inputSnapshot: generation.inputSnapshot,
        previewReport: makePreviewReportSummary(generation.previewReport),
        timeline: generation.timeline || [],
        coverageReport: generation.coverageReport,
        coverageSummary: generation.coverageReport && generation.coverageReport.coverageSummary,
        failedBatches: generation.failedBatches || [],
        invalidItems: generation.invalidItems || [],
        repairNeeded: generation.repairNeeded || [],
        validationErrors: generation.validationErrors || generation.errors || [],
        errors: generation.errors || []
      },
      errors: [],
      warnings: generation.warnings || []
    };
  }

  const draftReport = getDraftPackReport(generation.packId, {
    ...options,
    extraction
  });
  const sourceMatch = draftReport.sourceMatch || makePrepareReviewSourceMatch(extraction, draftReport.draftPack);
  return {
    success: true,
    data: {
      packId: generation.packId,
      title: generation.title || draftReport.draftPack?.title || generation.packId,
      message: generation.partialDraft === true
        ? 'Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.'
        : 'Review draft prepared.',
      partialDraft: generation.partialDraft === true,
      failedBatches: generation.failedBatches || [],
      sourceMatch,
      draftReport,
      importEstimate,
      autoImportPlan,
      selectedImport: selectedImportRequested,
      importSelection: generation.importSelection,
      importScope: generation.importScope,
      selectedImportEstimate: generation.selectedImportEstimate,
      coverageReport: generation.coverageReport || draftReport.coverageReport || null,
      coverageSummary: generation.coverageReport && generation.coverageReport.coverageSummary
        || draftReport.coverageReport && draftReport.coverageReport.coverageSummary
        || null,
      sourceManifest: generation.coverageReport && Array.isArray(generation.coverageReport.sourceManifest)
        ? generation.coverageReport.sourceManifest
        : draftReport.coverageReport && Array.isArray(draftReport.coverageReport.sourceManifest)
          ? draftReport.coverageReport.sourceManifest
          : [],
      reviewState: generation.coverageReport && generation.coverageReport.allChunksTerminal === true
        ? (generation.partialDraft === true ? 'partial' : 'completed')
        : 'partial',
      timeline: generation.timeline || [],
      dashboard: getTeacherContentDashboard(options),
      drafts: listDraftPacksForReview(options).draftPacks
    },
    errors: [],
    warnings: generation.warnings || []
  };
}

function normalizeImportProfile(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (IMPORT_PROFILE_VALUES.has(raw)) return raw;
  return 'general';
}

function buildExtractionTimeline(uploadData = {}) {
  const fileName = firstNonEmptyString(uploadData.originalFileName, uploadData.extraction && uploadData.extraction.fileName);
  return [
    {
      type: 'upload_received',
      message: 'Upload received',
      at: new Date().toISOString(),
      details: {
        fileName,
        uploadId: uploadData.uploadId || ''
      }
    },
    {
      type: 'extraction_complete',
      message: 'Extraction complete',
      at: new Date().toISOString(),
      details: {
        characterCount: Number(uploadData.characterCount || 0),
        pageCount: Number(uploadData.extraction && uploadData.extraction.pageCount || 0),
        chunkCount: Number(uploadData.sectionsCount || 0)
      }
    }
  ];
}

function makeTimelineEvent(type, message, details = {}) {
  return {
    type,
    message,
    at: new Date().toISOString(),
    details
  };
}

function makePreviewReportSummary(previewReport = {}) {
  const pack = previewReport.pack || {};
  return {
    title: pack.title || '',
    pack,
    partialPreview: previewReport.partialPreview === true,
    partialPreviewReason: previewReport.partialPreviewReason || '',
    validationPassed: previewReport.validationPassed === true,
    message: previewReport.message || '',
    model: previewReport.model || '',
    previewMode: previewReport.previewMode || '',
    maxPreviewChars: Number(previewReport.maxPreviewChars || 0),
    sourceFiles: Array.isArray(pack.sourceFiles) ? pack.sourceFiles.map((source) => source.fileName).filter(Boolean) : [],
    processedPageCount: Number(previewReport.processedPageCount || 0),
    processedCharacterCount: Number(previewReport.processedCharacterCount || 0),
    processedChunkCount: Number(previewReport.processedChunkCount || 0),
    itemCounts: {
      vocabulary: Array.isArray(pack.vocabulary) ? pack.vocabulary.length : 0,
      concepts: Array.isArray(pack.concepts) ? pack.concepts.length : 0,
      referenceFormulas: Array.isArray(pack.referenceFormulas) ? pack.referenceFormulas.length : 0,
      problemBank: Array.isArray(pack.problemBank) ? pack.problemBank.length : 0,
      standardsMap: Array.isArray(pack.standardsMap) ? pack.standardsMap.length : 0,
      smokeTests: Array.isArray(pack.smokeTests) ? pack.smokeTests.length : 0
    },
    deduplication: previewReport.deduplication || pack.metadata && pack.metadata.deduplication || {},
    importNormalization: previewReport.importNormalization || pack.metadata && pack.metadata.importNormalization || {},
    inputSnapshot: previewReport.inputSnapshot || null,
    importScope: previewReport.importScope || pack.metadata && pack.metadata.importScope || null,
    coverageReport: previewReport.coverageReport,
    coverageSummary: previewReport.coverageReport && previewReport.coverageReport.coverageSummary,
    failedBatches: previewReport.failedBatches || [],
    invalidItems: previewReport.invalidItems || [],
    repairNeeded: previewReport.repairNeeded || [],
    validationErrors: previewReport.validationErrors || previewReport.errors || [],
    rawModelResponsePath: previewReport.rawModelResponsePath || '',
    warnings: previewReport.warnings || [],
    errors: previewReport.errors || []
  };
}

function makeRouteImportSelection(body = {}) {
  const selection = body.importSelection && typeof body.importSelection === 'object' ? body.importSelection : {};
  const selectedPages = Array.isArray(body.selectedPages) ? body.selectedPages : Array.isArray(selection.selectedPages) ? selection.selectedPages : [];
  const selectedChunks = Array.isArray(body.selectedChunks) ? body.selectedChunks : Array.isArray(selection.selectedChunks) ? selection.selectedChunks : [];
  const pageRange = firstNonEmptyString(body.pageRange, selection.pageRange, selection.pages);
  const rangeMatch = String(pageRange || '').match(/(\d+)\s*(?:-|–|to)\s*(\d+)/i)
    || String(pageRange || '').match(/^\s*(\d+)\s*$/);
  return {
    pageStart: positiveNumberOrUndefined(body.pageStart)
      || positiveNumberOrUndefined(body.importPageStart)
      || positiveNumberOrUndefined(selection.pageStart)
      || positiveNumberOrUndefined(selection.startPage)
      || positiveNumberOrUndefined(selectedPages[0])
      || positiveNumberOrUndefined(rangeMatch && rangeMatch[1]),
    pageEnd: positiveNumberOrUndefined(body.pageEnd)
      || positiveNumberOrUndefined(body.importPageEnd)
      || positiveNumberOrUndefined(selection.pageEnd)
      || positiveNumberOrUndefined(selection.endPage)
      || positiveNumberOrUndefined(selectedPages[selectedPages.length - 1])
      || positiveNumberOrUndefined(rangeMatch && (rangeMatch[2] || rangeMatch[1])),
    chunkStart: positiveNumberOrUndefined(body.chunkStart)
      || positiveNumberOrUndefined(body.importChunkStart)
      || positiveNumberOrUndefined(selection.chunkStart)
      || positiveNumberOrUndefined(selection.startChunk)
      || positiveNumberOrUndefined(selectedChunks[0]),
    chunkEnd: positiveNumberOrUndefined(body.chunkEnd)
      || positiveNumberOrUndefined(body.importChunkEnd)
      || positiveNumberOrUndefined(selection.chunkEnd)
      || positiveNumberOrUndefined(selection.endChunk)
      || positiveNumberOrUndefined(selectedChunks[selectedChunks.length - 1])
  };
}

function hasUsableImportSelection(selection = {}) {
  if (!selection || typeof selection !== 'object') return false;
  return Boolean(
    positiveNumberOrUndefined(selection.pageStart)
    || positiveNumberOrUndefined(selection.pageEnd)
    || positiveNumberOrUndefined(selection.chunkStart)
    || positiveNumberOrUndefined(selection.chunkEnd)
  );
}

function resolveAutoImportMode(autoImportPlan = {}) {
  if (autoImportPlan.mode === 'manual_review_needed') return '';
  return 'full';
}

function makeAutoImportSelection(autoImportPlan = {}, importEstimate = {}) {
  const firstBatch = Array.isArray(autoImportPlan.batches) ? autoImportPlan.batches[0] : null;
  const pageNumbers = Array.isArray(firstBatch && firstBatch.pageNumbers)
    ? firstBatch.pageNumbers.map(Number).filter((page) => Number.isFinite(page) && page > 0)
    : [];
  if (pageNumbers.length) {
    return {
      pageStart: Math.min(...pageNumbers),
      pageEnd: Math.max(...pageNumbers)
    };
  }
  const textPages = Array.isArray(importEstimate.textBearingPages)
    ? importEstimate.textBearingPages
    : Array.isArray(importEstimate.pagesWithText)
      ? importEstimate.pagesWithText
      : [];
  const firstTextPage = positiveNumberOrUndefined(importEstimate.firstTextPage)
    || positiveNumberOrUndefined(textPages[0]);
  if (firstTextPage) {
    return {
      pageStart: firstTextPage,
      pageEnd: firstTextPage
    };
  }
  return null;
}

function makeRouteImportSelectionLabel(selection = {}) {
  if (selection.pageStart) {
    const end = selection.pageEnd || selection.pageStart;
    return `Pages ${selection.pageStart}-${end}`;
  }
  if (selection.chunkStart) {
    const end = selection.chunkEnd || selection.chunkStart;
    return `Chunks ${selection.chunkStart}-${end}`;
  }
  return 'Selected Range';
}

function makeScopedRoutePackName(packName, details = {}) {
  if (nonEmptyString(packName)) return packName.trim();
  const baseName = 'Teacher Upload';
  const importIntent = String(details.importIntent || '').trim().toLowerCase();
  const scopeLabel = details.previewOnly || importIntent === 'preview_range' || importIntent === 'preview'
    ? 'Preview Sample'
    : details.selectedImportRequested
      ? 'Selected Range'
      : 'Full Import';
  const rangeLabel = details.selectedImportRequested || details.previewOnly
    ? details.selectionLabel
    : makeTextBearingRangeLabel(details.importEstimate);
  const suffix = rangeLabel ? ` ${rangeLabel}` : '';
  return `${scopeLabel}: ${baseName}${suffix}`;
}

function makeTextBearingRangeLabel(importEstimate = {}) {
  const pages = Array.isArray(importEstimate.textBearingPages)
    ? importEstimate.textBearingPages
    : Array.isArray(importEstimate.pagesWithText)
      ? importEstimate.pagesWithText
      : [];
  const range = pages.length === 1 ? `${Number(pages[0])}-${Number(pages[0])}` : formatNumberRange(pages);
  if (range) return `Pages ${range}`;
  if (importEstimate.pageCount) return `Pages 1-${importEstimate.pageCount}`;
  return '';
}

function formatNumberRange(values) {
  const unique = Array.from(new Set((Array.isArray(values) ? values : []).map(Number).filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  if (!unique.length) return '';
  if (unique.length === 1) return String(unique[0]);
  const ranges = [];
  let start = unique[0];
  let previous = unique[0];
  for (let index = 1; index < unique.length; index += 1) {
    const value = unique[index];
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = value;
    previous = value;
  }
  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges.join(', ');
}

function makePrepareReviewSourceMatch(extraction, draftPack) {
  const originalFileName = firstNonEmptyString(extraction && extraction.upload && extraction.upload.originalFileName, extraction && extraction.fileName);
  const sourceFiles = [];
  return {
    uploadedFileName: originalFileName,
    draftPackId: draftPack && draftPack.packId || '',
    draftTitle: draftPack && draftPack.title || '',
    draftSourceFiles: sourceFiles,
    extractionCharacterCount: extraction ? String(extraction.text || '').length : 0,
    pageCount: extraction && extraction.metadata ? Number(extraction.metadata.pageCount || 0) : 0,
    chunkCount: extraction && Array.isArray(extraction.sections) ? extraction.sections.length : 0,
    status: 'unknown',
    warning: ''
  };
}

function makePrepareReviewFailurePayload(result = {}, context = {}) {
  const errors = Array.isArray(result.errors) && result.errors.length ? result.errors : ['Review draft preparation failed.'];
  const extraction = context.extraction || null;
  const importSelection = context.importSelection || makeRouteImportSelection(context.body || {});
  const extractionCounts = makePrepareReviewExtractionCounts(extraction);
  const fileName = firstNonEmptyString(
    extraction && extraction.upload && extraction.upload.originalFileName,
    extraction && extraction.fileName,
    result.fileName
  );
  const sourceType = firstNonEmptyString(
    extraction && extraction.metadata && extraction.metadata.detectedType,
    extraction && extraction.extension,
    extraction && extraction.mimeGuess,
    result.sourceType
  );
  const teacherFriendlyError = firstNonEmptyString(result.teacherFriendlyError, firstError(errors, 'Review draft preparation failed.'));
  return {
    ...result,
    success: false,
    ok: false,
    error: teacherFriendlyError,
    message: teacherFriendlyError,
    details: joinMessages(errors),
    teacherFriendlyError,
    errors,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    uploadId: context.uploadId || '',
    fileName,
    originalFileName: fileName,
    sourceType,
    upload: extraction && extraction.upload ? extraction.upload : null,
    importSelection,
    selectedRange: makeRouteImportSelectionLabel(importSelection),
    extractionCounts,
    extractionMetadata: extraction && extraction.metadata ? extraction.metadata : null,
    extractionSummary: {
      uploadId: context.uploadId || '',
      fileName,
      originalFileName: fileName,
      sourceType,
      metadata: extraction && extraction.metadata ? extraction.metadata : null,
      ...extractionCounts
    },
    extraction: extraction ? makeExtractionSummary(extraction) : null,
    importEstimate: result.importEstimate || context.importEstimate,
    autoImportPlan: result.autoImportPlan || context.autoImportPlan,
    validationErrors: result.validationErrors || [],
    invalidItems: result.invalidItems || [],
    repairNeeded: result.repairNeeded || [],
    failedBatches: result.failedBatches || [],
    coverageReport: result.coverageReport || null,
    sourceManifest: result.coverageReport && Array.isArray(result.coverageReport.sourceManifest)
      ? result.coverageReport.sourceManifest
      : [],
    reviewState: result.coverageReport && result.coverageReport.allChunksTerminal === true ? 'partial' : 'incomplete',
    coverageSummary: result.coverageReport && result.coverageReport.coverageSummary,
    rawModelResponsePath: result.rawModelResponsePath || ''
  };
}

function makePrepareReviewExtractionCounts(extraction) {
  if (!extraction) {
    return {
      characterCount: 0,
      pageCount: 0,
      chunkCount: 0,
      firstTextPage: null,
      textBearingPages: [],
      pagesWithText: []
    };
  }
  const textBearingPageInfo = identifyTextBearingPages(extraction);
  return {
    characterCount: Number(
      extraction.characterCount
      || extraction.metadata && extraction.metadata.characterCount
      || String(extraction.text || '').length
      || 0
    ),
    pageCount: Number(
      extraction.pageCount
      || extraction.metadata && extraction.metadata.pageCount
      || (Array.isArray(extraction.pages) ? extraction.pages.length : 0)
      || 0
    ),
    chunkCount: Number(
      extraction.chunkCount
      || extraction.sectionsCount
      || (Array.isArray(extraction.sections) ? extraction.sections.length : 0)
      || 0
    ),
    firstTextPage: textBearingPageInfo.firstTextPage,
    textBearingPages: textBearingPageInfo.pages,
    pagesWithText: textBearingPageInfo.pages
  };
}

function isNoUsablePreviewFailure(generation = {}) {
  if (Array.isArray(generation.errors) && generation.errors.some((error) => String(error || '').toLowerCase().includes('no usable preview items'))) {
    return true;
  }
  if (Array.isArray(generation.invalidItems) && generation.invalidItems.length > 0 && !generation.packId) {
    return true;
  }
  return Array.isArray(generation.errors)
    && generation.errors.length > 0
    && generation.errors.every((error) => /\[[0-9]+\]\./.test(String(error || '')));
}

function isModelCrashGenerationFailure(generation = {}) {
  return generation.modelCrash === true
    || (Array.isArray(generation.errors) && generation.errors.some((error) => isModelCrashMessage(error)))
    || (Array.isArray(generation.failedBatches) && generation.failedBatches.some((batch) => (
      Array.isArray(batch.errors) && batch.errors.some((error) => isModelCrashMessage(error))
    )));
}

function isModelTimeoutGenerationFailure(generation = {}) {
  return generation.modelTimeout === true
    || (Array.isArray(generation.errors) && generation.errors.some((error) => isModelTimeoutMessage(error)))
    || (Array.isArray(generation.failedBatches) && generation.failedBatches.some((batch) => (
      Array.isArray(batch.errors) && batch.errors.some((error) => isModelTimeoutMessage(error))
    )));
}

function resolvePrepareReviewGenerationTimeoutMs({
  body = {},
  options = {},
  previewOnly = false,
  selectedImportRequested = false,
  autoRecommendationAccepted = false
} = {}) {
  const explicit = positiveNumberOrUndefined(body.timeoutMs);
  if (explicit) return explicit;
  if (autoRecommendationAccepted) {
    return positiveNumberOrUndefined(options.autoAnalyzeGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentAutoAnalyzeGenerationTimeoutMs)
      || AUTO_ANALYZE_TIMEOUT_MS;
  }
  if (previewOnly || selectedImportRequested) {
    return positiveNumberOrUndefined(options.previewGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentPreviewGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.selectedGenerationTimeoutMs)
      || positiveNumberOrUndefined(options.teacherContentSelectedGenerationTimeoutMs)
      || DEFAULT_PREVIEW_SELECTED_GENERATION_TIMEOUT_MS;
  }
  return positiveNumberOrUndefined(options.fullGenerationTimeoutMs)
    || positiveNumberOrUndefined(options.teacherContentFullGenerationTimeoutMs)
    || positiveNumberOrUndefined(options.timeoutMs)
    || DEFAULT_FULL_GENERATION_TIMEOUT_MS;
}

function makeAutoAnalyzeGenerationOptions(options = {}) {
  const maxBatchCharacters = Math.min(
    positiveNumberOrUndefined(options.maxBatchCharacters) || AUTO_ANALYZE_MAX_BATCH_CHARACTERS,
    AUTO_ANALYZE_MAX_BATCH_CHARACTERS
  );
  const retryMaxBatchCharacters = Math.min(
    positiveNumberOrUndefined(options.retryMaxBatchCharacters) || Math.max(1, Math.floor(maxBatchCharacters / 2)),
    Math.max(1, Math.floor(maxBatchCharacters / 2)),
    AUTO_ANALYZE_RETRY_MAX_BATCH_CHARACTERS
  );
  return {
    ...options,
    maxBatchCharacters,
    retryMaxBatchCharacters,
    maxBatchChunks: 1,
    maxSectionsPerBatch: 1,
    autoAnalyzeUltraSafe: true
  };
}

function combineImportTimelines(...timelines) {
  const entries = timelines.flatMap((timeline) => Array.isArray(timeline) ? timeline : []);
  const merged = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const key = `${entry.type || 'activity'}:${entry.message || ''}`;
    const existingIndex = merged.findIndex((candidate) => `${candidate.type || 'activity'}:${candidate.message || ''}` === key);
    if (existingIndex < 0) {
      merged.push(entry);
      return;
    }
    merged[existingIndex] = preferTimelineEntry(merged[existingIndex], entry);
  });
  return merged;
}

function preferTimelineEntry(left, right) {
  return timelineDetailScore(right && right.details) >= timelineDetailScore(left && left.details) ? right : left;
}

function timelineDetailScore(details) {
  if (!details || typeof details !== 'object') return 0;
  return Number(details.pageCount || 0)
    + Number(details.chunkCount || 0)
    + (Number(details.characterCount || 0) / 100000);
}

function readJsonFile(filePath, label) {
  try {
    return {
      success: true,
      value: JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')),
      errors: []
    };
  } catch (error) {
    return {
      success: false,
      value: null,
      errors: [`Could not read or parse ${label}: ${error.message}`]
    };
  }
}

function getExtractionJsonPathForUpload(uploadId, options = {}) {
  const extractedDir = path.resolve(getUploadExtractedDir(options));
  const extractionJsonPath = path.resolve(extractedDir, `${uploadId}_extraction.json`);
  if (path.dirname(extractionJsonPath) !== extractedDir) {
    throw makeHttpError('uploadId resolved outside the extracted uploads directory.', 400);
  }
  return extractionJsonPath;
}

function sanitizeStandardsBankPath(standardsBankPath, options = {}) {
  if (!nonEmptyString(standardsBankPath)) return undefined;
  const resolved = path.resolve(standardsBankPath);
  const allowedRoot = path.resolve(options.standardsBanksDir || path.join(__dirname, '..', 'knowledge', 'standards-banks'));
  return isPathInside(resolved, allowedRoot) ? resolved : undefined;
}

function isPathInside(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath);
  return relativePath === '' || Boolean(relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function makeExtractionSummary(extraction) {
  const sourceManifest = Array.isArray(extraction.sourceManifest)
    ? extraction.sourceManifest
    : Array.isArray(extraction.metadata && extraction.metadata.sourceManifest)
      ? extraction.metadata.sourceManifest
      : [];
  return {
    success: extraction.success === true,
    fileName: extraction.fileName || '',
    extension: extraction.extension || '',
    mimeGuess: extraction.mimeGuess || '',
    detectedType: extraction.metadata?.detectedType || 'unsupported',
    characterCount: extraction.text.length,
    pageCount: Number(extraction.metadata && extraction.metadata.pageCount || 0),
    sectionsCount: extraction.sections.length,
    tablesCount: extraction.tables.length,
    sourceManifest,
    warnings: extraction.warnings || [],
    errors: extraction.errors || []
  };
}

function makeUploadId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
}

function sanitizeOriginalFileName(fileName) {
  return path.basename(String(fileName || ''))
    .normalize('NFKC')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function readSingleMultipartUpload(req, options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_UPLOAD_LIMIT_BYTES);
  const contentType = String(req.headers && (req.headers['content-type'] || req.headers['Content-Type']) || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    return Promise.reject(makeHttpError('Expected multipart/form-data upload with one source file.', 400));
  }

  const contentLength = Number(req.headers && (req.headers['content-length'] || req.headers['Content-Length']) || 0);
  if (contentLength > maxBytes) {
    return Promise.reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
  }

  return readRequestBuffer(req, maxBytes).then((body) => {
    const files = parseMultipartFiles(body, boundaryMatch[1] || boundaryMatch[2]);
    if (files.length !== 1) {
      if (files.length === 0) {
        throw makeHttpError('No file was received by the upload route.', 400);
      }
      throw makeHttpError('Upload must include exactly one source file.', 400);
    }
    if (!files[0].buffer.length) {
      throw makeHttpError('Uploaded source file is empty.', 400);
    }
    return files[0];
  });
}

function readRequestBuffer(req, maxBytes) {
  if (Buffer.isBuffer(req.rawBody)) {
    if (req.rawBody.length > maxBytes) {
      return Promise.reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
    }
    return Promise.resolve(req.rawBody);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(makeHttpError(`Upload is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)} MB.`, 413));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipartFiles(body, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const files = [];
  const fields = {};
  let cursor = body.indexOf(boundaryBuffer);

  while (cursor >= 0) {
    cursor += boundaryBuffer.length;
    if (body.slice(cursor, cursor + 2).toString('latin1') === '--') break;
    if (body.slice(cursor, cursor + 2).toString('latin1') === '\r\n') cursor += 2;

    const nextBoundary = body.indexOf(boundaryBuffer, cursor);
    if (nextBoundary < 0) break;

    let part = body.slice(cursor, nextBoundary);
    if (part.slice(-2).toString('latin1') === '\r\n') {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd >= 0) {
      const headers = parsePartHeaders(part.slice(0, headerEnd).toString('latin1'));
      const disposition = headers['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="([^"]*)"/i);
      const nameMatch = disposition.match(/name="([^"]*)"/i);
      if (filenameMatch && filenameMatch[1]) {
        files.push({
          originalFileName: filenameMatch[1],
          buffer: part.slice(headerEnd + 4),
          contentType: headers['content-type'] || 'application/octet-stream',
          fields
        });
      } else if (nameMatch && nameMatch[1]) {
        fields[nameMatch[1]] = part.slice(headerEnd + 4).toString('utf8');
      }
    }

    cursor = nextBoundary;
  }

  files.forEach((file) => {
    file.fields = fields;
  });
  return files;
}

function parsePartHeaders(headerText) {
  return String(headerText || '').split('\r\n').reduce((headers, line) => {
    const separator = line.indexOf(':');
    if (separator > 0) {
      headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
    }
    return headers;
  }, {});
}

function makeHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function makeRouteErrorPayload(message, details) {
  const error = firstNonEmptyString(message, 'Teacher content request failed.');
  return {
    ok: false,
    success: false,
    error,
    details: firstNonEmptyString(details, error),
    errors: [error],
    warnings: []
  };
}

function sendJson(res, getData) {
  try {
    return res.json({
      success: true,
      data: getData()
    });
  } catch (error) {
    return sendRouteError(res, error);
  }
}

function sendRouteError(res, error) {
  return res.status(500).json({
    success: false,
    errors: [error instanceof Error ? error.message : String(error)]
  });
}

function isSafePackId(packId) {
  return SAFE_PACK_ID_PATTERN.test(packId);
}

function isSafeUploadId(uploadId) {
  return SAFE_UPLOAD_ID_PATTERN.test(uploadId);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstNonEmptyString(...values) {
  return values.find(nonEmptyString) || '';
}

function getKnowledgeNameFromFields(fields = {}) {
  return firstNonEmptyString(
    fields.knowledgeName,
    fields.packName,
    fields.packTitle,
    fields.title,
    fields.name
  ).trim();
}

function firstError(errors, fallback) {
  return Array.isArray(errors) && errors.length > 0 ? String(errors[0]) : fallback;
}

function joinMessages(messages) {
  return Array.isArray(messages) ? messages.map(String).filter(Boolean).join('; ') : '';
}

function positiveNumberOrUndefined(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function stripStatusCode(result) {
  const { statusCode, ...payload } = result;
  return payload;
}

function validateDraftItemRouteParams(params = {}) {
  const packId = String(params.packId || '').trim();
  if (!isSafePackId(packId)) {
    return {
      success: false,
      errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
    };
  }

  const section = String(params.section || '').trim();
  if (!REVIEWABLE_SECTIONS.includes(section)) {
    return {
      success: false,
      errors: [`section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`]
    };
  }

  const index = Number(params.index);
  if (!Number.isInteger(index) || index < 0 || String(params.index).trim() !== String(index)) {
    return {
      success: false,
      errors: [`index must be a non-negative integer for ${section}.`]
    };
  }

  return {
    success: true,
    packId,
    section,
    index,
    errors: []
  };
}

function extractDraftItemRef(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const itemId = String(input.itemId || '').trim();
  const sourceFile = String(input.sourceFile || '').trim();
  const sourceLocation = String(input.sourceLocation || '').trim();
  const title = String(input.title || '').trim();
  const term = String(input.term || '').trim();
  if (!itemId && !sourceFile && !sourceLocation && !title && !term) return null;
  return { itemId, sourceFile, sourceLocation, title, term };
}

function resolveDraftItemMutationTarget({ packId, section, requestedIndex, itemRef, options = {} }) {
  const parsedIndex = Number(requestedIndex);
  const fallback = {
    success: true,
    index: parsedIndex,
    requestedIndex: parsedIndex,
    resolvedBy: 'index'
  };
  if (!itemRef) return fallback;

  const draft = loadDraftPackJsonForRoute(packId, options);
  if (!draft.success) {
    return {
      success: false,
      statusCode: 404,
      errors: draft.errors || ['Draft pack could not be loaded for item resolution.']
    };
  }

  const items = Array.isArray(draft.pack && draft.pack[section]) ? draft.pack[section] : [];
  if (!items.length) {
    return {
      success: false,
      statusCode: 400,
      errors: [`No items found in section ${section}.`]
    };
  }

  if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < items.length && draftItemMatchesRef(items[parsedIndex], itemRef)) {
    return {
      success: true,
      index: parsedIndex,
      requestedIndex: parsedIndex,
      resolvedBy: 'index_and_itemRef'
    };
  }

  const matchedIndices = items
    .map((item, index) => (draftItemMatchesRef(item, itemRef) ? index : -1))
    .filter((index) => index >= 0);
  if (matchedIndices.length === 1) {
    return {
      success: true,
      index: matchedIndices[0],
      requestedIndex: parsedIndex,
      resolvedBy: 'itemRef'
    };
  }
  if (matchedIndices.length > 1) {
    return {
      success: false,
      statusCode: 409,
      errors: ['Multiple draft items matched this edit request. Reopen the row and try again so the latest item identity is used.'],
      matchedIndices
    };
  }
  return {
    success: false,
    statusCode: 409,
    errors: ['The selected draft item changed after refresh. Reopen the row and try again.'],
    requestedIndex: parsedIndex
  };
}

function loadDraftPackJsonForRoute(packId, options = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const readResult = readJsonFile(draftPackPath, `draft pack ${packId}`);
  if (!readResult.success) {
    return {
      success: false,
      draftPackPath,
      errors: readResult.errors || ['Draft pack could not be read.']
    };
  }
  return {
    success: true,
    draftPackPath,
    pack: readResult.value
  };
}

function draftItemMatchesRef(item, itemRef) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const hasItemId = nonEmptyString(itemRef && itemRef.itemId);
  const hasSourceFile = nonEmptyString(itemRef && itemRef.sourceFile);
  const hasSourceLocation = nonEmptyString(itemRef && itemRef.sourceLocation);
  const hasTitle = nonEmptyString(itemRef && itemRef.title);
  const hasTerm = nonEmptyString(itemRef && itemRef.term);

  const itemIdMatches = !hasItemId || normalizeComparableString(draftItemIdentity(item)) === normalizeComparableString(itemRef.itemId);
  const sourceFileMatches = !hasSourceFile || normalizeComparableString(item.sourceFile) === normalizeComparableString(itemRef.sourceFile);
  const sourceLocationMatches = !hasSourceLocation || normalizeComparableString(item.sourceLocation) === normalizeComparableString(itemRef.sourceLocation);
  const titleMatches = !hasTitle || normalizeComparableString(item.title) === normalizeComparableString(itemRef.title);
  const termMatches = !hasTerm || normalizeComparableString(item.term) === normalizeComparableString(itemRef.term);
  if (hasItemId && (hasSourceFile || hasSourceLocation)) {
    return itemIdMatches && sourceFileMatches && sourceLocationMatches;
  }
  if (hasItemId) return itemIdMatches;
  if (hasSourceFile || hasSourceLocation) {
    return sourceFileMatches && sourceLocationMatches && titleMatches && termMatches;
  }
  if (hasTitle || hasTerm) return titleMatches && termMatches;
  return false;
}

function draftItemIdentity(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  return firstNonEmptyString(
    item.itemId,
    item.term,
    item.title,
    item.question,
    item.equation,
    item.standardId,
    item.conceptId,
    item.formulaId,
    item.problemId
  );
}

function normalizeComparableString(value) {
  return String(value || '').trim().toLowerCase();
}

function sendDraftMutationResponse(res, update, packId, options, debugContext = {}) {
  const debug = buildDraftMutationDebugPayload(update, packId, options, debugContext);
  if (!update.success) {
    const status = (update.errors || []).some((error) => String(error).includes('No draft knowledge pack found'))
      ? 404
      : 400;
    return res.status(status).json({
      success: false,
      errors: update.errors || ['Draft item update failed.'],
      warnings: update.warnings || [],
      debug
    });
  }

  const report = getDraftPackReport(packId, options);
  return res.json({
    success: true,
    data: {
      update,
      report,
      debug: {
        ...debug,
        refreshedItem: summarizeReportItem(report, debugContext.request && debugContext.request.section, debugContext.request && debugContext.request.index),
        remainingBlockers: summarizeRemainingBlockers(report)
      }
    },
    errors: [],
    warnings: report.warnings || []
  });
}

function buildDraftMutationDebugPayload(update, packId, options, debugContext = {}) {
  const request = debugContext.request && typeof debugContext.request === 'object' ? debugContext.request : {};
  const beforeSnapshot = debugContext.beforeSnapshot || null;
  const afterSnapshot = debugContext.afterSnapshot || null;
  const draftPackPath = update && update.draftPackPath ? update.draftPackPath : resolveDraftPackJsonPath(packId, options);
  const fileStats = safeFileStats(draftPackPath);

  return {
    routeHandler: debugContext.routeHandler || '',
    request,
    draftPackPath,
    updateSummary: summarizeDraftMutationUpdate(update),
    beforeSnapshot,
    afterSnapshot,
    savedPath: update && update.savedPath ? update.savedPath : null,
    diskState: {
      exists: fileStats.exists,
      mtimeMs: fileStats.mtimeMs
    }
  };
}

function summarizeDraftMutationUpdate(update = {}) {
  return {
    success: update.success === true,
    action: update.action || '',
    changedField: update.changedField || '',
    editedFields: Array.isArray(update.editedFields) ? update.editedFields : [],
    before: Object.prototype.hasOwnProperty.call(update, 'before') ? update.before : undefined,
    after: Object.prototype.hasOwnProperty.call(update, 'after') ? update.after : undefined,
    validationPassed: update.validationPassed === true,
    errors: Array.isArray(update.errors) ? update.errors : [],
    warnings: Array.isArray(update.warnings) ? update.warnings : []
  };
}

function summarizeRemainingBlockers(report = {}) {
  const readiness = report && report.promotionReadiness && typeof report.promotionReadiness === 'object'
    ? report.promotionReadiness
    : {};
  const blockedReasons = Array.isArray(readiness.blockedReasons) ? readiness.blockedReasons : [];
  const blockerSummary = readiness.blockerSummary && typeof readiness.blockerSummary === 'object'
    ? readiness.blockerSummary
    : null;
  return {
    ready: readiness.ready === true,
    blockedReasons,
    blockerSummary: blockerSummary && typeof blockerSummary.message === 'string'
      ? blockerSummary.message
      : ''
  };
}

function summarizeReportItem(report, section, index) {
  if (!report || !section || !Number.isInteger(Number(index))) return null;
  const groups = report.reviewItems && report.reviewItems.items && typeof report.reviewItems.items === 'object'
    ? report.reviewItems.items
    : {};
  const row = Array.isArray(groups[section])
    ? groups[section].find((item) => Number(item && item.index) === Number(index))
    : null;
  if (!row || typeof row !== 'object') return null;
  return {
    section,
    index: Number(index),
    itemId: row.itemId || row.term || row.title || row.standardId || '',
    reviewStatus: row.reviewStatus || '',
    teacherReviewed: row.teacherReviewed === true,
    teacherVerified: row.teacherVerified === true,
    manuallyEdited: row.manuallyEdited === true,
    confidenceOverride: row.confidenceOverride || '',
    sourceFile: row.sourceFile || '',
    sourceLocation: row.sourceLocation || '',
    sourceTextSnippetLength: String(row.sourceTextSnippet || '').trim().length
  };
}

function readDraftItemSnapshot(packId, section, index, options = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const readResult = readJsonFile(draftPackPath, `draft pack ${packId}`);
  if (!readResult.success || !readResult.value) {
    return {
      success: false,
      draftPackPath,
      errors: readResult.errors || ['Draft pack could not be read.']
    };
  }

  const sectionItems = Array.isArray(readResult.value[section]) ? readResult.value[section] : [];
  const row = sectionItems[Number(index)];
  if (!row || typeof row !== 'object') {
    return {
      success: false,
      draftPackPath,
      errors: [`No item found at ${section}[${index}].`]
    };
  }

  return {
    success: true,
    draftPackPath,
    item: summarizeDraftFileItem(section, Number(index), row)
  };
}

function summarizeDraftFileItem(section, index, item = {}) {
  return {
    section,
    index,
    itemId: item.itemId || item.term || item.title || item.standardId || '',
    reviewStatus: item.reviewStatus || '',
    teacherReviewed: item.teacherReviewed === true,
    teacherVerified: item.teacherVerified === true,
    manuallyEdited: item.manuallyEdited === true,
    teacherApproved: item.teacherApproved === true,
    confidence: item.confidence || '',
    confidenceOverride: item.confidenceOverride || '',
    term: item.term || '',
    title: item.title || '',
    studentDefinition: item.studentDefinition || '',
    studentExplanation: item.studentExplanation || '',
    equation: item.equation || '',
    question: item.question || '',
    expectedAnswer: item.expectedAnswer || '',
    standardId: item.standardId || '',
    sourceFile: item.sourceFile || '',
    sourceLocation: item.sourceLocation || '',
    sourceTextSnippetLength: String(item.sourceTextSnippet || '').trim().length,
    missingRequiredFields: summarizeMissingRequiredFields(item)
  };
}

function summarizeMissingRequiredFields(item = {}) {
  const missing = [];
  if (!nonEmptyString(item.sourceFile)) missing.push('sourceFile');
  if (!nonEmptyString(item.sourceLocation)) missing.push('sourceLocation');
  if (!nonEmptyString(item.sourceTextSnippet)) missing.push('sourceTextSnippet');
  const hasIdentifier = nonEmptyString(item.term)
    || nonEmptyString(item.title)
    || nonEmptyString(item.question)
    || nonEmptyString(item.equation)
    || nonEmptyString(item.standardId);
  if (!hasIdentifier) missing.push('identifier');
  return missing;
}

function resolveDraftPackJsonPath(packId, options = {}) {
  const draftRoot = path.resolve(options.draftPacksDir || DEFAULT_DRAFT_PACKS_DIR);
  return path.resolve(draftRoot, packId, 'knowledge_pack.json');
}

function safeFileStats(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      mtimeMs: Number(stats.mtimeMs || 0)
    };
  } catch (_error) {
    return {
      exists: false,
      mtimeMs: 0
    };
  }
}

function buildPromotionDebugPayload(packId, options, report, promotion = {}) {
  const draftPackPath = resolveDraftPackJsonPath(packId, options);
  const draftFileStats = safeFileStats(draftPackPath);
  const draftSnapshot = readDraftItemSnapshot(packId, 'vocabulary', 0, options);
  const reportReady = report && report.promotionReadiness && report.promotionReadiness.ready === true;
  const blockedReasons = report && report.promotionReadiness && Array.isArray(report.promotionReadiness.blockedReasons)
    ? report.promotionReadiness.blockedReasons
    : [];
  return {
    packId,
    promotionSuccess: promotion.success === true,
    draftPackPath,
    draftFileMtimeMs: draftFileStats.mtimeMs,
    draftSnapshotPreview: draftSnapshot.success ? draftSnapshot.item : null,
    promotionReadinessReady: reportReady,
    blockedReasons,
    promotionOutputPath: promotion.outputPath || null
  };
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
