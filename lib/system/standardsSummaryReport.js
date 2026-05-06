const fs = require('fs');

const DEFAULT_EXAMPLE_LIMIT = 3;
const DEFAULT_RECENT_LIMIT = 10;
const CONFIDENCE_LEVELS = ['strong', 'medium', 'weak', 'none'];

function buildStandardsSummaryReport(entries, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const exampleLimit = positiveInteger(options.maxExampleQuestions ?? options.exampleLimit, DEFAULT_EXAMPLE_LIMIT);
  const recentLimit = positiveInteger(options.maxRecentTaggedQuestions ?? options.recentLimit, DEFAULT_RECENT_LIMIT);
  const validEntries = Array.isArray(entries) ? entries.filter(isPlainObject) : [];

  const standardsById = new Map();
  const possibleStandardsById = new Map();
  const conceptsById = new Map();
  const unitsByName = new Map();
  const routeTypeCounts = new Map();
  const courseProfileCounts = new Map();
  const standardsBankCounts = new Map();
  const confidenceCounts = {
    strong: 0,
    medium: 0,
    weak: 0,
    none: 0
  };
  const conceptConfidenceCounts = {
    strong: 0,
    medium: 0,
    weak: 0,
    none: 0
  };
  const recentTaggedQuestions = [];

  let taggedQuestions = 0;

  for (const entry of validEntries) {
    const standards = getPrimaryStandards(entry);
    const possibleStandards = normalizeStandards(entry.possibleStandards);
    const concepts = normalizeConcepts(entry.matchedConcepts);
    const units = collectUnits(entry, standards, concepts);
    const routeType = normalizeText(entry.routeType || entry.routerType || entry.type) || 'unknown';
    const standardsConfidence = normalizeConfidence(entry.standardsConfidence);
    const conceptConfidence = normalizeConfidence(entry.conceptConfidence);
    const courseProfileId = normalizeText(entry.courseProfileId);
    const standardsBankId = normalizeText(entry.standardsBankId);
    const example = compactExample(entry, {
      routeType,
      standardsConfidence,
      conceptConfidence,
      standards,
      possibleStandards,
      concepts,
      units
    });
    const isTagged = standards.length > 0 || possibleStandards.length > 0 || concepts.length > 0 || units.length > 0;

    increment(routeTypeCounts, routeType);
    if (courseProfileId) increment(courseProfileCounts, courseProfileId);
    if (standardsBankId) increment(standardsBankCounts, standardsBankId);
    confidenceCounts[standardsConfidence] += 1;
    conceptConfidenceCounts[conceptConfidence] += 1;

    if (isTagged) {
      taggedQuestions += 1;
      recentTaggedQuestions.push(example);
    }

    const entryPossibleStandardIds = new Set();
    for (const standard of possibleStandards) {
      if (!standard.standardId || entryPossibleStandardIds.has(standard.standardId)) continue;
      entryPossibleStandardIds.add(standard.standardId);

      const row = getOrCreate(possibleStandardsById, standard.standardId, () => ({
        standardId: standard.standardId,
        label: standard.label,
        unit: standard.unit,
        count: 0,
        routeTypes: {},
        exampleQuestions: []
      }));

      row.count += 1;
      row.label = row.label || standard.label;
      row.unit = row.unit || standard.unit;
      row.routeTypes[routeType] = (row.routeTypes[routeType] || 0) + 1;
      addLimitedExample(row.exampleQuestions, example, exampleLimit);
    }

    const entryStandardIds = new Set();
    for (const standard of standards) {
      if (!standard.standardId || entryStandardIds.has(standard.standardId)) continue;
      entryStandardIds.add(standard.standardId);

      const row = getOrCreate(standardsById, standard.standardId, () => ({
        standardId: standard.standardId,
        label: standard.label,
        unit: standard.unit,
        count: 0,
        routeTypes: {},
        standardsConfidence: {
          strong: 0,
          medium: 0,
          weak: 0,
          none: 0
        },
        exampleQuestions: []
      }));

      row.count += 1;
      row.label = row.label || standard.label;
      row.unit = row.unit || standard.unit;
      row.routeTypes[routeType] = (row.routeTypes[routeType] || 0) + 1;
      row.standardsConfidence[standardsConfidence] += 1;
      addLimitedExample(row.exampleQuestions, example, exampleLimit);
    }

    const entryConceptIds = new Set();
    for (const concept of concepts) {
      if (!concept.id || entryConceptIds.has(concept.id)) continue;
      entryConceptIds.add(concept.id);

      const row = getOrCreate(conceptsById, concept.id, () => ({
        id: concept.id,
        title: concept.title,
        type: concept.type,
        unit: concept.unit,
        count: 0,
        totalScore: 0,
        scoredCount: 0,
        exampleQuestions: []
      }));

      row.count += 1;
      row.title = row.title || concept.title;
      row.type = row.type || concept.type;
      row.unit = row.unit || concept.unit;
      if (Number.isFinite(concept.score)) {
        row.totalScore += concept.score;
        row.scoredCount += 1;
      }
      addLimitedExample(row.exampleQuestions, example, exampleLimit);
    }

    for (const unit of units) {
      const row = getOrCreate(unitsByName, unit, () => ({
        unit,
        count: 0,
        standardIds: new Set(),
        conceptIds: new Set(),
        exampleQuestions: []
      }));

      row.count += 1;
      for (const standard of standards) {
        if (standard.unit === unit && standard.standardId) row.standardIds.add(standard.standardId);
      }
      for (const concept of concepts) {
        if (concept.unit === unit && concept.id) row.conceptIds.add(concept.id);
      }
      addLimitedExample(row.exampleQuestions, example, exampleLimit);
    }
  }

  return {
    generatedAt: now.toISOString(),
    totalQuestions: validEntries.length,
    taggedQuestions,
    untaggedQuestions: validEntries.length - taggedQuestions,
    standards: Array.from(standardsById.values())
      .map((row) => ({
        standardId: row.standardId,
        label: row.label,
        unit: row.unit,
        count: row.count,
        routeTypes: sortCountObject(row.routeTypes),
        standardsConfidence: row.standardsConfidence,
        exampleQuestions: row.exampleQuestions
      }))
      .sort((a, b) => compareCountThenText(a, b, 'standardId')),
    possibleStandardsSummary: Array.from(possibleStandardsById.values())
      .map((row) => ({
        standardId: row.standardId,
        label: row.label,
        unit: row.unit,
        count: row.count,
        routeTypes: sortCountObject(row.routeTypes),
        exampleQuestions: row.exampleQuestions
      }))
      .sort((a, b) => compareCountThenText(a, b, 'standardId')),
    concepts: Array.from(conceptsById.values())
      .map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        unit: row.unit,
        count: row.count,
        averageScore: row.scoredCount ? roundOneDecimal(row.totalScore / row.scoredCount) : 0,
        exampleQuestions: row.exampleQuestions
      }))
      .sort((a, b) => compareCountThenText(a, b, 'title')),
    units: Array.from(unitsByName.values())
      .map((row) => ({
        unit: row.unit,
        count: row.count,
        standardsCount: row.standardIds.size,
        conceptsCount: row.conceptIds.size,
        exampleQuestions: row.exampleQuestions
      }))
      .sort((a, b) => compareCountThenText(a, b, 'unit')),
    routeTypes: Array.from(routeTypeCounts.entries())
      .map(([routeType, count]) => ({ routeType, count }))
      .sort((a, b) => compareCountThenText(a, b, 'routeType')),
    standardsConfidence: confidenceCounts,
    conceptConfidence: conceptConfidenceCounts,
    courseProfileIds: mapToSortedCounts(courseProfileCounts, 'courseProfileId'),
    standardsBankIds: mapToSortedCounts(standardsBankCounts, 'standardsBankId'),
    recentTaggedQuestions: recentTaggedQuestions
      .sort(compareExamplesNewestFirst)
      .slice(0, recentLimit)
  };
}

function loadStudentInteractionLogs(logFilePath) {
  try {
    if (!fs.existsSync(logFilePath)) return [];

    const raw = fs.readFileSync(logFilePath, 'utf8').trim();
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPrimaryStandards(entry) {
  if (Object.prototype.hasOwnProperty.call(entry, 'primaryStandards')) {
    return normalizeStandards(entry.primaryStandards);
  }

  return normalizeStandards(entry.standards);
}

function normalizeStandards(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainObject)
    .map((standard) => ({
      standardId: normalizeText(standard.standardId),
      label: normalizeText(standard.label),
      unit: normalizeText(standard.unit)
    }))
    .filter((standard) => standard.standardId);
}

function normalizeConcepts(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isPlainObject)
    .map((concept) => ({
      id: normalizeText(concept.id),
      title: normalizeText(concept.title),
      type: normalizeText(concept.type),
      unit: normalizeText(concept.unit),
      score: Number.isFinite(Number(concept.score)) ? Number(concept.score) : null
    }))
    .filter((concept) => concept.id);
}

function collectUnits(entry, standards, concepts) {
  const units = new Set();

  if (Array.isArray(entry.units)) {
    for (const unit of entry.units) {
      const normalized = normalizeText(unit);
      if (normalized) units.add(normalized);
    }
  }

  for (const standard of standards) {
    if (standard.unit) units.add(standard.unit);
  }

  for (const concept of concepts) {
    if (concept.unit) units.add(concept.unit);
  }

  return Array.from(units).sort((a, b) => a.localeCompare(b));
}

function compactExample(entry, metadata) {
  return {
    timestamp: normalizeText(entry.timestamp || entry.createdAt || entry.updatedAt),
    question: normalizeText(entry.studentQuestion || entry.question || entry.message),
    routeType: metadata.routeType,
    standardsConfidence: metadata.standardsConfidence,
    conceptConfidence: metadata.conceptConfidence,
    units: metadata.units,
    standards: metadata.standards.map((standard) => ({
      standardId: standard.standardId,
      label: standard.label,
      unit: standard.unit
    })),
    possibleStandards: metadata.possibleStandards.map((standard) => ({
      standardId: standard.standardId,
      label: standard.label,
      unit: standard.unit
    })),
    concepts: metadata.concepts.map((concept) => ({
      id: concept.id,
      title: concept.title,
      type: concept.type,
      unit: concept.unit
    }))
  };
}

function normalizeConfidence(value) {
  const confidence = normalizeText(value).toLowerCase();
  return CONFIDENCE_LEVELS.includes(confidence) ? confidence : 'none';
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getOrCreate(map, key, createValue) {
  if (!map.has(key)) map.set(key, createValue());
  return map.get(key);
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function addLimitedExample(examples, example, limit) {
  if (examples.length < limit) examples.push(example);
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function sortCountObject(counts) {
  return Object.fromEntries(
    Object.entries(counts).sort(([routeA, countA], [routeB, countB]) => {
      if (countB !== countA) return countB - countA;
      return routeA.localeCompare(routeB);
    })
  );
}

function mapToSortedCounts(map, keyName) {
  return Array.from(map.entries())
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a[keyName] || '').localeCompare(String(b[keyName] || ''));
    });
}

function compareCountThenText(a, b, textKey) {
  if (b.count !== a.count) return b.count - a.count;
  return String(a[textKey] || '').localeCompare(String(b[textKey] || ''));
}

function compareExamplesNewestFirst(a, b) {
  return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
}

module.exports = {
  buildStandardsSummaryReport,
  loadStudentInteractionLogs
};
