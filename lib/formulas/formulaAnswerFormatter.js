// Shared formula answer formatting helpers.
function answer(notes, lines) {
  return { notes, answer: lines.join('\n') };
}

function plural(unit, value) {
  if (unit === 'mile' && Math.abs(value) !== 1) return 'miles';
  return unit;
}

function cleanNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '');
}

module.exports = {
  answer,
  cleanNumber,
  plural
};
