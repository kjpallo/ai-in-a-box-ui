const { normalizeGraphTerm } = require('./knowledgeGraph');

function cleanLabel(value, options = {}) {
  const maxLength = getMaxLength(options.maxLength, 100);
  return applyMaxLength(
    String(value || '').replace(/\s+/g, ' ').trim(),
    maxLength
  );
}

function cleanSentence(value, options = {}) {
  const maxLength = getMaxLength(options.maxLength, 220);
  let sentence = String(value || '').replace(/\s+/g, ' ').trim();

  if (options.trimTrailingPunctuation !== false) {
    sentence = sentence.replace(/[;:]\s*$/g, '');
  }

  sentence = applyMaxLength(sentence, maxLength);
  if (!sentence) return '';

  if (options.ensureTerminalPunctuation && !/[.!?]$/.test(sentence)) {
    return `${sentence}.`;
  }

  return sentence;
}

function ensureSentence(value, options = {}) {
  const text = cleanSentence(value, {
    ...options,
    ensureTerminalPunctuation: false
  });
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function formatList(labels, options = {}) {
  const clean = uniqueFormattedLabels(labels, options);
  if (clean.length <= 1) return clean[0] || '';
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

function displayLabel(value) {
  const label = cleanLabel(value).replace(/^Concept\s+\d+:\s+/i, '');
  if (/^[A-Z]{1,3}\s*=/.test(label)) return label;
  return lowerFirst(label);
}

function sentenceCase(value, options = {}) {
  const text = cleanLabel(value, options);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(value, options = {}) {
  const text = cleanLabel(value, options);
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function formatGraphPath(path, options = {}) {
  const nodes = path?.nodes || [];
  const edges = path?.edges || [];
  if (nodes.length < 2 || edges.length < 1) return '';

  const nodeFormatter = typeof options.nodeFormatter === 'function'
    ? options.nodeFormatter
    : displayLabel;
  const relationshipFormatter = typeof options.relationshipFormatter === 'function'
    ? options.relationshipFormatter
    : formatRelationshipLabel;

  const parts = [nodeFormatter(nodes[0]?.label)];
  edges.forEach((edge, index) => {
    const nextNode = nodes[index + 1];
    parts.push(relationshipFormatter(edge), nodeFormatter(nextNode?.label));
  });

  return parts.filter(Boolean).join(' -> ');
}

function isApprovedGraphContext(graphContext) {
  return graphContext && graphContext.aiAllowed === false;
}

function uniqueFormattedLabels(labels, options = {}) {
  const cleanItem = typeof options.cleanItem === 'function'
    ? options.cleanItem
    : cleanListItem;
  const formatItem = typeof options.formatItem === 'function'
    ? options.formatItem
    : displayLabel;
  const normalizeItem = typeof options.normalizeItem === 'function'
    ? options.normalizeItem
    : normalizeGraphTerm;
  const seen = new Set();
  const result = [];

  (Array.isArray(labels) ? labels : []).forEach((label) => {
    const clean = cleanItem(label);
    const key = normalizeItem(clean);
    if (!clean || !key || seen.has(key)) return;
    seen.add(key);

    const formatted = formatItem(clean);
    if (formatted) result.push(formatted);
  });

  return result;
}

function cleanListItem(value) {
  return cleanSentence(value).replace(/\.$/, '');
}

function formatRelationshipLabel(edge = {}) {
  return cleanLabel(edge.label || edge.type || 'related to').replace(/_/g, ' ');
}

function getMaxLength(value, fallback) {
  if (value === null) return null;
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function applyMaxLength(value, maxLength) {
  return maxLength === null ? value : value.slice(0, maxLength);
}

module.exports = {
  cleanLabel,
  cleanSentence,
  ensureSentence,
  formatList,
  displayLabel,
  sentenceCase,
  lowerFirst,
  formatGraphPath,
  isApprovedGraphContext
};
