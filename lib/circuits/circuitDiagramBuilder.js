const NUMBER_WORDS = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5
};

function tryCircuitDiagram(message) {
  const text = normalize(message);
  if (!text || !hasCircuitDiagramIntent(text)) return null;

  const request = parseCircuitRequest(text);

  if (request.hasVoltmeter) {
    return buildVoltmeterCircuit(request);
  }

  if (request.type === 'parallel') {
    return buildParallelCircuit(request);
  }

  if (request.type === 'series' || request.hasAmmeter) {
    return buildSeriesCircuit(request);
  }

  return null;
}

function buildSeriesCircuit(request = {}) {
  const components = buildSeriesComponents(request);
  const topLine = `${components.map(labelComponent).join(' -- ')} --+`;
  const returnLine = `|${'-'.repeat(Math.max(topLine.length - 2, 12))}+`;
  const diagramText = [
    topLine,
    returnLine
  ].join('\n');

  const switchLine = request.switchState === 'open'
    ? 'The open switch leaves a break/gap, so current cannot flow.'
    : request.switchState === 'closed'
      ? 'The closed switch completes the path, so current can flow.'
      : null;
  const meterLine = request.hasAmmeter
    ? 'The ammeter is in series so all the current passes through it.'
    : null;

  return {
    id: request.hasAmmeter ? 'em_diag_004' : 'em_diag_001',
    kind: 'series',
    answer: [
      'Series circuit - one path for current.',
      'This is a series circuit with one complete path through every part.',
      switchLine,
      meterLine,
      '',
      diagramText,
      '',
      'Check: Does current have only one complete path?'
    ].filter((line) => line !== null).join('\n'),
    diagramText
  };
}

function buildParallelCircuit(request = {}) {
  const sources = buildBatteryLabels(request.batteries);
  const prefixParts = [...sources];
  if (request.mainSwitch) prefixParts.push('Main Switch');

  const branchParts = buildParallelBranches(request);
  const prefix = `${prefixParts.map(labelComponent).join(' -- ')} -- `;
  const diagramText = branchParts.map((branch, index) => {
    const connector = index === 0
      ? '+--'
      : index === branchParts.length - 1
        ? '+--'
        : '+--';
    const end = index === 0
      ? '--+'
      : index === branchParts.length - 1
        ? '--+'
        : '--|';
    const lead = index === 0 ? prefix : ' '.repeat(prefix.length);
    return `${lead}${connector} ${branch.map(labelComponent).join(' -- ')} ${end}`;
  }).join('\n');

  const switchLine = request.branchSwitches
    ? 'Each branch switch can turn one light off individually.'
    : request.mainSwitch
      ? 'The main switch is before the branches so it can turn the whole circuit off.'
      : null;

  return {
    id: request.branchSwitches ? 'em_diag_008' : 'em_diag_007',
    kind: 'parallel',
    answer: [
      'Parallel circuit - more than one path, or branch, for current.',
      'This is a parallel circuit with separate branches for the loads.',
      switchLine,
      '',
      diagramText,
      '',
      'Check: Does each bulb have its own branch/path?'
    ].filter((line) => line !== null).join('\n'),
    diagramText
  };
}

function buildVoltmeterCircuit(request = {}) {
  const target = request.voltmeterTarget || 'component';
  const targetLabel = titleCase(target);
  const mainComponents = [
    ...buildBatteryLabels(request.batteries || 1),
    request.switches > 0 ? switchLabel(request) : null,
    targetLabel
  ].filter(Boolean);
  const mainLine = `${mainComponents.map(labelComponent).join(' -- ')} --+`;
  const returnLine = `|${'-'.repeat(Math.max(mainLine.length - 2, 12))}+`;
  const indent = Math.max(mainLine.indexOf(`[${targetLabel}]`) - 2, 0);
  const diagramText = [
    mainLine,
    `${' '.repeat(indent)}|-- [Voltmeter] --|`,
    returnLine
  ].join('\n');

  return {
    id: 'em_diag_005',
    kind: 'series_with_voltmeter',
    answer: [
      'Circuit with voltmeter - the main path stays complete.',
      `Place the Voltmeter across, or parallel to, the ${targetLabel} so it measures voltage across that part.`,
      '',
      diagramText,
      '',
      `Check: Is the Voltmeter connected across both sides of the ${targetLabel}?`
    ].join('\n'),
    diagramText
  };
}

function parseCircuitRequest(text) {
  const switches = countComponent(text, 'switch', 'switches', 1);
  const lightBulbs = countLightBulbs(text);
  const branchSwitches = switches > 1 || looksLikeBranchSwitches(text);

  return {
    type: hasPhrase(text, 'parallel circuit') || /\bparallel\b/.test(text)
      ? 'parallel'
      : hasPhrase(text, 'series circuit') || /\bseries\b/.test(text)
        ? 'series'
        : null,
    batteries: countComponent(text, 'battery', 'batteries', 1),
    lightBulbs,
    resistors: countComponent(text, 'resistor', 'resistors', 0),
    resistorValue: parseResistorValue(text),
    motors: countComponent(text, 'motor', 'motors', 0),
    switches,
    hasAmmeter: /\bammeter\b/.test(text) || hasPhrase(text, 'measure current'),
    hasVoltmeter: /\bvoltmeter\b/.test(text),
    voltmeterTarget: parseVoltmeterTarget(text),
    switchState: /\bopen switch\b/.test(text)
      ? 'open'
      : /\bclosed switch\b/.test(text)
        ? 'closed'
        : null,
    mainSwitch: switches > 0 && (!branchSwitches || looksLikeMainSwitch(text)),
    branchSwitches
  };
}

function buildSeriesComponents(request) {
  return [
    ...buildBatteryLabels(request.batteries),
    request.switches > 0 ? switchLabel(request) : null,
    request.hasAmmeter ? 'Ammeter' : null,
    ...numberedLabels('Light Bulb', request.lightBulbs),
    ...buildResistorLabels(request),
    ...numberedLabels('Motor', request.motors)
  ].filter(Boolean);
}

function buildParallelBranches(request) {
  const branches = [];
  const branchCount = Math.max(request.lightBulbs, request.resistors, request.motors, 2);

  for (let index = 1; index <= branchCount; index += 1) {
    const branch = [];
    if (request.branchSwitches && index <= Math.max(request.switches, request.lightBulbs)) {
      branch.push(`Switch ${index}`);
    }
    if (index <= request.lightBulbs) branch.push(numberedLabel('Light Bulb', index, request.lightBulbs));
    if (index <= request.motors) branch.push(numberedLabel('Motor', index, request.motors));
    if (index <= request.resistors) branch.push(numberedLabel(resistorBaseLabel(request), index, request.resistors));
    if (branch.length === 0) branch.push(`Branch ${index} Load`);
    branches.push(branch);
  }

  return branches;
}

function buildBatteryLabels(count) {
  return numberedLabels('Battery', Math.max(count || 1, 1));
}

function buildResistorLabels(request) {
  return numberedLabels(resistorBaseLabel(request), request.resistors);
}

function resistorBaseLabel(request) {
  return request.resistorValue ? `${request.resistorValue} ohm Resistor` : 'Resistor';
}

function switchLabel(request) {
  if (request.switchState === 'open') return 'Open Switch';
  if (request.switchState === 'closed') return 'Closed Switch';
  return 'Switch';
}

function numberedLabels(base, count) {
  if (!count) return [];
  return Array.from({ length: count }, (_, index) => numberedLabel(base, index + 1, count));
}

function numberedLabel(base, index, total) {
  return total > 1 ? `${base} ${index}` : base;
}

function labelComponent(label) {
  return `[${label}]`;
}

function countLightBulbs(text) {
  if (!/\b(?:light\s+bulb|light\s+bulbs|bulb|bulbs|light|lights)\b/.test(text)) return 0;

  return countComponent(text, 'light bulb', 'light bulbs', null) ||
    countComponent(text, 'bulb', 'bulbs', null) ||
    countComponent(text, 'light', 'lights', 1);
}

function countComponent(text, singular, plural, defaultIfMentioned) {
  const singularPattern = escapeRegExp(singular).replace(/\s+/g, '\\s+');
  const pluralPattern = escapeRegExp(plural).replace(/\s+/g, '\\s+');
  const numberPattern = '(\\d+|one|two|three|four|five|a|an)';
  const countMatch = text.match(new RegExp(`\\b${numberPattern}\\s+(?:${singularPattern}|${pluralPattern})\\b`));
  if (countMatch) return numberValue(countMatch[1]);
  if (new RegExp(`\\b(?:${singularPattern}|${pluralPattern})\\b`).test(text)) return defaultIfMentioned ?? 1;
  return 0;
}

function numberValue(value) {
  return NUMBER_WORDS[value] || Number.parseInt(value, 10) || 1;
}

function parseResistorValue(text) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*ohm\s+resistor\b/);
  return match ? match[1] : '';
}

function parseVoltmeterTarget(text) {
  if (/\bmotor\b/.test(text)) return 'motor';
  if (/\b(?:light\s+bulb|bulb|light)\b/.test(text)) return 'light bulb';
  if (/\bresistor\b/.test(text)) return 'resistor';
  if (/\bbattery\b/.test(text)) return 'battery';
  return 'component';
}

function looksLikeMainSwitch(text) {
  return hasPhrase(text, 'main switch') ||
    hasPhrase(text, 'whole circuit') ||
    hasPhrase(text, 'turn the whole circuit off');
}

function looksLikeBranchSwitches(text) {
  return hasPhrase(text, 'each light') ||
    hasPhrase(text, 'each bulb') ||
    hasPhrase(text, 'individually') ||
    hasPhrase(text, 'individual switches');
}

function hasCircuitDiagramIntent(text) {
  const asksToDraw = /\b(?:draw|drawing|sketch|show|create|make)\b/.test(text);
  if (asksToDraw && hasPhrase(text, 'circuit')) return true;

  if (hasPhrase(text, 'circuit diagram') || hasPhrase(text, 'diagram of a circuit')) return true;

  const addsMeter = /\b(?:add|place|include)\b/.test(text) && /\b(?:ammeter|voltmeter)\b/.test(text);
  return addsMeter && /\b(?:measure|measuring|current|voltage|across|parallel)\b/.test(text);
}

function hasPhrase(text, phrase) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  const escaped = escapeRegExp(normalizedPhrase).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`).test(text);
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
