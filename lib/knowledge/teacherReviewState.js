function isLowConfidenceValue(confidence) {
  return String(confidence || '').trim().toLowerCase() === 'low';
}

function hasTeacherLowConfidenceOverride(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (item.teacherVerified === true) return true;
  if (item.teacherReviewed === true) return true;
  if (item.manuallyEdited === true) return true;
  const overrideValue = String(
    item.confidenceOverride
      || item.confidenceStatus
      || item.reviewConfidence
      || item.teacherConfidence
      || ''
  ).trim().toLowerCase();
  return overrideValue === 'teacher_verified' || overrideValue === 'teacher-reviewed';
}

function stampTeacherReview(item, options = {}) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const reviewedAt = new Date().toISOString();
  item.teacherReviewed = true;
  item.teacherVerified = true;
  if (options.edited === true) item.manuallyEdited = true;
  if (options.approved === true) item.teacherApproved = true;
  item.teacherReviewedAt = reviewedAt;
  if (options.edited === true) item.lastManualEditAt = reviewedAt;
  if (isLowConfidenceValue(item.confidence)) {
    item.confidenceOverride = 'teacher_verified';
  }
  return item;
}

module.exports = {
  hasTeacherLowConfidenceOverride,
  isLowConfidenceValue,
  stampTeacherReview
};
