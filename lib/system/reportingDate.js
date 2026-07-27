function reportingDateKeyFromEntry(entry = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';

  for (const value of [
    entry.questionDate,
    entry.reportDate,
    entry.localDate,
    entry.date
  ]) {
    const explicitDate = normalizeDateKey(value);
    if (explicitDate) return explicitDate;
  }

  return reportingDateKeyFromTimestamp(
    entry.timestamp ||
    entry.createdAt ||
    entry.lastSeenAt ||
    entry.updatedAt ||
    entry.time
  );
}

function reportingDateKeyFromTimestamp(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  const exactDate = normalizeDateKey(text);
  if (exactDate) return exactDate;

  const leadingDate = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/u)?.[1] || '';
  if (leadingDate && !normalizeDateKey(leadingDate)) return '';

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return localDateKey(date);
}

function normalizeDateKey(value) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return '';

  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return '';
  }

  return text;
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return Boolean(normalizeDateKey(value));
}

module.exports = {
  isDateKey,
  localDateKey,
  normalizeDateKey,
  reportingDateKeyFromEntry,
  reportingDateKeyFromTimestamp
};
