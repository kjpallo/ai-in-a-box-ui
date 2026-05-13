function tryCircuitDiagram(message) {
  const text = normalize(message);
  if (!text || !hasCircuitDiagramIntent(text)) return null;

  if (hasPhrase(text, 'series circuit') || /\bseries\b/.test(text)) {
    return buildSeriesCircuit();
  }

  if (hasPhrase(text, 'parallel circuit') || /\bparallel\b/.test(text)) {
    return buildParallelCircuit();
  }

  return null;
}

function buildSeriesCircuit() {
  const diagramText = [
    '[Battery] -- [Switch] -- [Light Bulb]',
    '   |                         |',
    '   +-------------------------+'
  ].join('\n');

  return {
    id: 'em_diag_001',
    kind: 'series',
    answer: [
      'Series circuit - one path for current.',
      '',
      diagramText,
      '',
      'Check: Does current have only one complete path?'
    ].join('\n'),
    diagramText
  };
}

function buildParallelCircuit() {
  const diagramText = [
    '[Battery] -- [Main Switch] --+-- [Light Bulb 1] --+',
    '                            |                    |',
    '                            +-- [Light Bulb 2] --+'
  ].join('\n');

  return {
    id: 'em_diag_007',
    kind: 'parallel',
    answer: [
      'Parallel circuit - more than one path, or branch, for current.',
      '',
      diagramText,
      '',
      'Check: Does each bulb have its own branch/path?'
    ].join('\n'),
    diagramText
  };
}

function hasCircuitDiagramIntent(text) {
  if (!hasPhrase(text, 'circuit')) return false;

  return /\b(?:draw|drawing|sketch|show|create|make)\b/.test(text) ||
    hasPhrase(text, 'circuit diagram') ||
    hasPhrase(text, 'diagram of a circuit');
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  tryCircuitDiagram
};
