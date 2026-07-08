function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(arrayOrEmpty(values).filter(Boolean))];
}

function groupFactsByType(facts, { defaultType, idPrefix }) {
  return Object.values(arrayOrEmpty(facts).reduce((groups, fact) => {
    const type = fact.type || defaultType;
    if (!groups[type]) {
      groups[type] = {
        id: `${idPrefix}.${type}`,
        title: titleFromType(type),
        terms: [],
        sourceRefs: []
      };
    }
    groups[type].terms.push(fact.canonicalTerm);
    groups[type].sourceRefs = unique([
      ...groups[type].sourceRefs,
      ...arrayOrEmpty(fact.sourceRefs)
    ]);
    return groups;
  }, {}));
}

function titleFromType(type) {
  return String(type || '')
    .split('_')
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function collectRelationships(facts) {
  return arrayOrEmpty(facts).flatMap((fact) => arrayOrEmpty(fact.related).map((target) => ({
    id: `${fact.id}.related.${slug(target)}`,
    from: fact.canonicalTerm,
    relation: 'related to',
    to: target,
    sourceRefs: arrayOrEmpty(fact.sourceRefs)
  })));
}

function collectExamples(facts) {
  return arrayOrEmpty(facts).flatMap((fact) => [
    ...arrayOrEmpty(fact.examples).map((example) => ({ factId: fact.id, type: 'example', text: example })),
    ...arrayOrEmpty(fact.nonExamples).map((example) => ({ factId: fact.id, type: 'non_example', text: example }))
  ]);
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

module.exports = {
  arrayOrEmpty,
  collectExamples,
  collectRelationships,
  groupFactsByType,
  slug,
  titleFromType,
  unique
};
