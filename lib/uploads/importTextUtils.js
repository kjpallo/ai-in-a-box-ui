function firstNonEmptyString(...values) {
  return values.find(nonEmptyString) || '';
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizePackName(value) {
  if (!nonEmptyString(value)) return '';
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}


module.exports = {
  firstNonEmptyString,
  nonEmptyString,
  sanitizePackName
};
