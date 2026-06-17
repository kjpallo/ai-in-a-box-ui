const assert = require('node:assert/strict');

const {
  buildKnowledgeGraph,
  explainGraphPath,
  findGraphContext,
  normalizeGraphTerm
} = require('../lib/knowledge/knowledgeGraph');
const motionForceKnowledge = require('../lib/knowledge/physics/motion-force');
const teacherFacts = require('../knowledge/teacher_facts.json');

const graph = buildKnowledgeGraph([
  {
    pack: {
      packId: 'motion-force-local',
      title: 'Motion and Force Local Knowledge',
      source: 'local Motion/Force pack',
      vocabulary: motionForceKnowledge.vocabulary,
      concepts: motionForceKnowledge.concepts,
      referenceFormulas: motionForceKnowledge.formulas,
      problemBank: motionForceKnowledge.problemBank,
      standardsMap: []
    },
    packId: 'motion-force-local',
    title: 'Motion and Force Local Knowledge'
  }
], teacherFacts.items);

assert.ok(graph, 'graph should build');
assert.ok(Object.keys(graph.nodes).length > 0, 'graph should contain nodes');
assert.ok(Array.isArray(graph.edges), 'graph should contain an edges array');
assert.ok(graph.adjacency && typeof graph.adjacency === 'object', 'graph should contain adjacency');

const distance = findNodeByLabel(graph, 'distance');
const displacement = findNodeByLabel(graph, 'displacement');
const speed = findNodeByLabel(graph, 'speed');
const velocity = findNodeByLabel(graph, 'velocity');
const acceleration = findNodeByLabel(graph, 'acceleration');
const time = findNodeByLabel(graph, 'time');

assert.ok(distance, 'distance node should exist');
assert.ok(displacement, 'displacement node should exist');
assert.ok(speed, 'speed node should exist');
assert.ok(velocity, 'velocity node should exist');
assert.ok(acceleration, 'acceleration node should exist');
assert.ok(time, 'time node should exist');

assert.ok(
  hasLabeledEdge(graph, 'distance', 'displacement', 'commonly_confused_with'),
  'distance and displacement should be commonly confused'
);
assert.ok(
  hasLabeledEdge(graph, 'speed', 'velocity', 'related_to'),
  'speed and velocity should be related'
);
assert.ok(
  hasPathBetweenLabels(graph, 'displacement', 'velocity'),
  'displacement should have a path to velocity'
);
assert.ok(
  hasLabeledEdge(graph, 'acceleration', 'velocity', 'uses_concept'),
  'acceleration should link to velocity'
);
assert.ok(
  hasLabeledEdge(graph, 'acceleration', 'time', 'uses_concept'),
  'acceleration should link to time'
);

const speedVelocityContext = findGraphContext('How are speed and velocity related?', graph);
assert.ok(
  includesNodeLabel(speedVelocityContext.matchedNodes, 'speed'),
  'speed/velocity context should detect speed'
);
assert.ok(
  includesNodeLabel(speedVelocityContext.matchedNodes, 'velocity'),
  'speed/velocity context should detect velocity'
);

const displacementVelocityContext = findGraphContext('Why does displacement matter for velocity?', graph);
assert.ok(
  includesNodeLabel(displacementVelocityContext.matchedNodes, 'displacement'),
  'displacement/velocity context should detect displacement'
);
assert.ok(
  includesNodeLabel(displacementVelocityContext.matchedNodes, 'velocity'),
  'displacement/velocity context should detect velocity'
);
assert.ok(
  displacementVelocityContext.possiblePaths.length > 0,
  'displacement/velocity context should include a possible path'
);

function findNodeByLabel(graph, label) {
  const normalizedLabel = normalizeGraphTerm(label);
  return Object.values(graph.nodes).find((node) => normalizeGraphTerm(node.label) === normalizedLabel);
}

function findNodesByLabel(graph, label) {
  const normalizedLabel = normalizeGraphTerm(label);
  return Object.values(graph.nodes).filter((node) => normalizeGraphTerm(node.label) === normalizedLabel);
}

function hasLabeledEdge(graph, fromLabel, toLabel, type) {
  const fromIds = new Set(findNodesByLabel(graph, fromLabel).map((node) => node.id));
  const toIds = new Set(findNodesByLabel(graph, toLabel).map((node) => node.id));
  return graph.edges.some((edge) => fromIds.has(edge.from) && toIds.has(edge.to) && edge.type === type);
}

function hasPathBetweenLabels(graph, fromLabel, toLabel) {
  const fromNodes = findNodesByLabel(graph, fromLabel);
  const toNodes = findNodesByLabel(graph, toLabel);
  return fromNodes.some((fromNode) => toNodes.some((toNode) => explainGraphPath(graph, fromNode.id, toNode.id)));
}

function includesNodeLabel(nodes, label) {
  const normalizedLabel = normalizeGraphTerm(label);
  return nodes.some((node) => normalizeGraphTerm(node.label) === normalizedLabel);
}

console.log('Knowledge graph tests passed.');
