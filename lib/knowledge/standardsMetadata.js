const ALIGNMENT_STATUSES = new Set([
  'not_aligned_yet',
  'suggested',
  'teacher_approved',
  'rejected'
]);

const ALIGNMENT_SOURCES = new Set([
  'none',
  'teacher',
  'gemma',
  'import',
  'manual'
]);

function makeDefaultStandardsMetadata() {
  return {
    linkedStandardIds: [],
    suggestedStandardIds: [],
    alignmentStatus: 'not_aligned_yet',
    alignmentSource: 'none'
  };
}

function normalizeStandardsMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return makeDefaultStandardsMetadata();
  }

  const alignmentStatus = ALIGNMENT_STATUSES.has(value.alignmentStatus)
    ? value.alignmentStatus
    : 'not_aligned_yet';
  const alignmentSource = ALIGNMENT_SOURCES.has(value.alignmentSource)
    ? value.alignmentSource
    : 'none';

  return {
    linkedStandardIds: normalizeIdArray(value.linkedStandardIds),
    suggestedStandardIds: normalizeIdArray(value.suggestedStandardIds),
    alignmentStatus,
    alignmentSource
  };
}

function normalizeIdArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  ));
}

function getLinkedStandardIds(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
  if (Array.isArray(item.standards)) return normalizeIdArray(item.standards);
  return normalizeStandardsMetadata(item.standards).linkedStandardIds;
}

function validateStandardsMetadata(value, label, errors) {
  if (value === undefined) return;
  if (Array.isArray(value)) return;
  if (!value || typeof value !== 'object') {
    errors.push(`${label} must be an array of standard IDs or a standards metadata object.`);
    return;
  }

  if ('linkedStandardIds' in value && !Array.isArray(value.linkedStandardIds)) {
    errors.push(`${label}.linkedStandardIds must be an array.`);
  }
  if ('suggestedStandardIds' in value && !Array.isArray(value.suggestedStandardIds)) {
    errors.push(`${label}.suggestedStandardIds must be an array.`);
  }
  if ('alignmentStatus' in value && !ALIGNMENT_STATUSES.has(value.alignmentStatus)) {
    errors.push(`${label}.alignmentStatus must be one of: ${Array.from(ALIGNMENT_STATUSES).join(', ')}`);
  }
  if ('alignmentSource' in value && !ALIGNMENT_SOURCES.has(value.alignmentSource)) {
    errors.push(`${label}.alignmentSource must be one of: ${Array.from(ALIGNMENT_SOURCES).join(', ')}`);
  }
}

function validateStandardsMetadataReferences(item, label, approvedStandardIds, errors) {
  if (!approvedStandardIds || !item || typeof item !== 'object' || Array.isArray(item)) return;
  const standards = item.standards;
  const linked = Array.isArray(standards)
    ? normalizeIdArray(standards)
    : standards && typeof standards === 'object'
      ? normalizeIdArray(standards.linkedStandardIds)
      : [];
  const suggested = standards && typeof standards === 'object' && !Array.isArray(standards)
    ? normalizeIdArray(standards.suggestedStandardIds)
    : [];

  linked.forEach((standardId, index) => {
    if (!approvedStandardIds.has(standardId)) {
      errors.push(`${label}.standards.${Array.isArray(standards) ? index : `linkedStandardIds[${index}]`} has unknown standard reference: ${standardId}`);
    }
  });
  suggested.forEach((standardId, index) => {
    if (!approvedStandardIds.has(standardId)) {
      errors.push(`${label}.standards.suggestedStandardIds[${index}] has unknown standard reference: ${standardId}`);
    }
  });
}

function getStandardsAlignmentLabel(value) {
  const metadata = normalizeStandardsMetadata(value);
  if (metadata.alignmentStatus === 'not_aligned_yet') return 'not aligned yet';
  return metadata.alignmentStatus.replace(/_/g, ' ');
}

module.exports = {
  getLinkedStandardIds,
  getStandardsAlignmentLabel,
  makeDefaultStandardsMetadata,
  normalizeStandardsMetadata,
  validateStandardsMetadata,
  validateStandardsMetadataReferences
};
