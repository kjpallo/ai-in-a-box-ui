const fs = require('node:fs');
const path = require('node:path');

const SAFE_PACK_ID_PATTERN = /^[a-z0-9_-]+$/;
const SAFE_UPLOAD_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,127}$/;

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

module.exports = {
  firstError,
  firstNonEmptyString,
  getKnowledgeNameFromFields,
  isSafePackId,
  isSafeUploadId,
  joinMessages,
  makeHttpError,
  makeRouteErrorPayload,
  nonEmptyString,
  positiveNumberOrUndefined,
  readJsonFile,
  sendJson,
  sendRouteError,
  stripStatusCode
};
