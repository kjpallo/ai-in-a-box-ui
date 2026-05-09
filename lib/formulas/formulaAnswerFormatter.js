// Shared formula answer formatting helpers.
function answer(notes, lines, formulaWork = null) {
  const result = { notes, answer: lines.join('\n') };
  if (formulaWork) result.formulaWork = formulaWork;
  return result;
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
