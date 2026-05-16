const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_APPROVED_PACKS_DIR, loadApprovedKnowledgePacks } = require('./loadApprovedKnowledgePacks');

const ACTIVATION_FILE_NAME = '_activation.json';
const SAFE_PACK_ID_PATTERN = /^[a-z0-9_-]+$/;

function getApprovedPackActivationPath(options = {}) {
  return path.join(options.approvedPacksDir || DEFAULT_APPROVED_PACKS_DIR, ACTIVATION_FILE_NAME);
}

function loadApprovedPackActivation(options = {}) {
  const activationPath = getApprovedPackActivationPath(options);
  if (!fs.existsSync(activationPath)) {
    return makeEmptyState();
  }

  const parsed = JSON.parse(fs.readFileSync(activationPath, 'utf8'));
  const packs = parsed && parsed.packs && typeof parsed.packs === 'object' ? parsed.packs : {};
  return {
    version: 1,
    packs: Object.keys(packs).reduce((clean, packId) => {
      if (!isSafePackId(packId)) return clean;
      const record = packs[packId] || {};
      clean[packId] = {
        enabled: record.enabled === true,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined
      };
      return clean;
    }, {})
  };
}

function saveApprovedPackActivation(state, options = {}) {
  const activationPath = getApprovedPackActivationPath(options);
  fs.mkdirSync(path.dirname(activationPath), { recursive: true });
  const nextState = normalizeState(state);
  fs.writeFileSync(activationPath, `${JSON.stringify(nextState, null, 2)}\n`);
  return nextState;
}

function getApprovedPackActivation(packId, options = {}) {
  assertSafePackId(packId);
  const state = loadApprovedPackActivation(options);
  const record = state.packs[packId] || {};
  return {
    enabled: record.enabled === true,
    updatedAt: record.updatedAt
  };
}

function setApprovedPackActivation(packId, enabled, options = {}) {
  assertSafePackId(packId);
  if (typeof enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean.');
  }
  if (!approvedPackExists(packId, options)) {
    const error = new Error('Approved pack not found.');
    error.statusCode = 404;
    throw error;
  }

  const state = loadApprovedPackActivation(options);
  const updatedAt = new Date().toISOString();
  state.packs[packId] = { enabled, updatedAt };
  saveApprovedPackActivation(state, options);
  return {
    packId,
    activationEnabled: enabled,
    activationStatus: enabled ? 'enabled' : 'disabled',
    activationUpdatedAt: updatedAt
  };
}

function mergeActivationIntoApprovedPackSummaries(summaries, options = {}) {
  const state = loadApprovedPackActivation(options);
  return (summaries || []).map((summary) => {
    const record = state.packs[summary.packId] || {};
    const activationEnabled = record.enabled === true;
    return {
      ...summary,
      activationEnabled,
      activationStatus: activationEnabled ? 'enabled' : 'disabled',
      activationUpdatedAt: record.updatedAt
    };
  });
}

function approvedPackExists(packId, options = {}) {
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    validationOptions: options.validationOptions || {}
  });
  return approved.packs.some((record) => record.packId === packId);
}

function normalizeState(state) {
  const packs = state && state.packs && typeof state.packs === 'object' ? state.packs : {};
  return {
    version: 1,
    packs: Object.keys(packs).reduce((clean, packId) => {
      assertSafePackId(packId);
      const record = packs[packId] || {};
      clean[packId] = {
        enabled: record.enabled === true,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
      };
      return clean;
    }, {})
  };
}

function makeEmptyState() {
  return {
    version: 1,
    packs: {}
  };
}

function assertSafePackId(packId) {
  if (!isSafePackId(packId)) {
    const error = new Error('packId must contain only lowercase letters, numbers, underscores, and hyphens.');
    error.statusCode = 400;
    throw error;
  }
}

function isSafePackId(packId) {
  return SAFE_PACK_ID_PATTERN.test(String(packId || '').trim());
}

module.exports = {
  ACTIVATION_FILE_NAME,
  getApprovedPackActivation,
  getApprovedPackActivationPath,
  loadApprovedPackActivation,
  mergeActivationIntoApprovedPackSummaries,
  saveApprovedPackActivation,
  setApprovedPackActivation
};
