const fs = require('node:fs');

const { loadApprovedKnowledgePacks } = require('./loadApprovedKnowledgePacks');
const {
  REVIEWABLE_SECTIONS,
  SAFE_EDIT_FIELDS
} = require('./reviewDraftKnowledgePack');
const { stampTeacherReview } = require('./teacherReviewState');
const { validateKnowledgePack } = require('./validateKnowledgePack');

function loadApprovedKnowledgePackForEdit(packId, options = {}) {
  const approved = loadApprovedKnowledgePacks({
    approvedPacksDir: options.approvedPacksDir,
    includeExamples: options.includeExamples === true || options.includeFixtures === true,
    includeFixtures: options.includeFixtures === true,
    validationOptions: { standardsBank: options.standardsBank, standardsPaused: true }
  });
  const record = approved.packs.find((entry) => String(entry.packId || '').trim() === packId) || null;
  if (!record) {
    return {
      success: false,
      statusCode: 404,
      errors: ['Approved knowledge pack not found.'],
      warnings: []
    };
  }
  return {
    success: true,
    packId,
    pack: record.pack,
    sourcePath: record.sourcePath,
    warnings: record.warnings || [],
    errors: []
  };
}

function normalizeApprovedItemEdits(section, edits) {
  if (!Array.isArray(edits) || edits.length === 0) {
    return {
      success: false,
      edits: [],
      errors: ['At least one approved item field must be provided.']
    };
  }

  const allowedFields = SAFE_EDIT_FIELDS[section];
  if (!allowedFields) {
    return {
      success: false,
      edits: [],
      errors: [`section must be one of: ${REVIEWABLE_SECTIONS.join(', ')}`]
    };
  }

  const normalized = [];
  const errors = [];
  edits.forEach((entry) => {
    const field = String(entry && entry.field || '').trim();
    if (!field) {
      errors.push('Each edit must include a field name.');
      return;
    }
    if (!allowedFields.has(field)) {
      errors.push(`Field ${section}.${field} is not editable in approved knowledge.`);
      return;
    }
    normalized.push({
      field,
      value: Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : ''
    });
  });

  return {
    success: errors.length === 0,
    edits: normalized,
    errors
  };
}

function editApprovedKnowledgePackItem(packId, section, index, edits, options = {}) {
  const loadResult = loadApprovedKnowledgePackForEdit(packId, options);
  if (!loadResult.success) return loadResult;

  const sectionItems = Array.isArray(loadResult.pack[section]) ? loadResult.pack[section] : [];
  if (index >= sectionItems.length) {
    return {
      success: false,
      statusCode: 404,
      errors: [`No approved item found at ${section}[${index}].`],
      warnings: loadResult.warnings || []
    };
  }

  const item = sectionItems[index];
  edits.forEach((edit) => {
    item[edit.field] = normalizeApprovedEditedValue(section, edit.field, edit.value);
  });
  if (section === 'referenceFormulas') {
    item.solverStatus = 'reference_only';
  }
  stampTeacherReview(item, { edited: true, approved: item.reviewStatus === 'approved' });
  loadResult.pack.metadata = {
    ...(loadResult.pack.metadata || {}),
    updatedAt: new Date().toISOString()
  };

  const validation = validateKnowledgePack(loadResult.pack, {
    standardsBank: options.standardsBank,
    standardsPaused: true
  });
  if (!validation.valid) {
    return {
      success: false,
      statusCode: 400,
      errors: validation.errors,
      warnings: [...(loadResult.warnings || []), ...validation.warnings]
    };
  }

  fs.writeFileSync(loadResult.sourcePath, `${JSON.stringify(loadResult.pack, null, 2)}\n`);
  return {
    success: true,
    packId,
    pack: loadResult.pack,
    item,
    sourcePath: loadResult.sourcePath,
    savedPath: loadResult.sourcePath,
    warnings: [...(loadResult.warnings || []), ...validation.warnings],
    errors: []
  };
}

function normalizeApprovedEditedValue(section, field, value) {
  if (section === 'concepts' && field === 'keyIdeas') {
    if (Array.isArray(value)) return value;
    return String(value)
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return String(value);
}

module.exports = {
  editApprovedKnowledgePackItem,
  loadApprovedKnowledgePackForEdit,
  normalizeApprovedItemEdits
};
