const express = require('express');

const {
  getDraftPackReport,
  getTeacherContentDashboard,
  listApprovedPacksSummary,
  listDraftPacksForReview
} = require('../lib/uploads/teacherContentAdapter');
const {
  REVIEWABLE_SECTIONS,
  SAFE_EDIT_FIELDS,
  editDraftItemField,
  updateDraftItemReviewStatus
} = require('../lib/knowledge/reviewDraftKnowledgePack');
const { REVIEW_STATUSES } = require('../lib/knowledge/packSchema');

const SAFE_PACK_ID_PATTERN = /^[a-z0-9_-]+$/;

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

  app.get('/drafts/:packId/report', (req, res) => {
    const packId = String(req.params && req.params.packId || '').trim();
    if (!isSafePackId(packId)) {
      return res.status(400).json({
        success: false,
        errors: ['packId must contain only lowercase letters, numbers, underscores, and hyphens.']
      });
    }

    try {
      const report = getDraftPackReport(packId, options);
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
      const update = updateDraftItemReviewStatus(
        validation.packId,
        validation.section,
        validation.index,
        reviewStatus,
        options
      );
      return sendDraftMutationResponse(res, update, validation.packId, options);
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
      const update = editDraftItemField(
        validation.packId,
        validation.section,
        validation.index,
        field,
        req.body && Object.prototype.hasOwnProperty.call(req.body, 'value') ? req.body.value : '',
        options
      );
      return sendDraftMutationResponse(res, update, validation.packId, options);
    } catch (error) {
      return sendRouteError(res, error);
    }
  });

  app.get('/approved', (_req, res) => {
    sendJson(res, () => listApprovedPacksSummary(options));
  });
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

function sendDraftMutationResponse(res, update, packId, options) {
  if (!update.success) {
    const status = (update.errors || []).some((error) => String(error).includes('No draft knowledge pack found'))
      ? 404
      : 400;
    return res.status(status).json({
      success: false,
      errors: update.errors || ['Draft item update failed.'],
      warnings: update.warnings || []
    });
  }

  const report = getDraftPackReport(packId, options);
  return res.json({
    success: true,
    data: {
      update,
      report
    },
    errors: [],
    warnings: report.warnings || []
  });
}

module.exports = {
  createTeacherContentRoutes,
  isSafePackId,
  registerTeacherContentRoutes
};
