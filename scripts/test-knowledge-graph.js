const assert = require('node:assert/strict');
const path = require('node:path');

const {
  buildKnowledgeGraph,
  explainGraphPath,
  findGraphContext,
  normalizeGraphTerm
} = require('../lib/knowledge/knowledgeGraph');
const {
  findRelevantKnowledge,
  loadTeacherKnowledge
} = require('../lib/knowledge/teacherKnowledge');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  buildFormulaTutorPrompt,
  canStartFormulaTutor,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');
const motionForceKnowledge = require('../lib/knowledge/physics/motion-force');
const teacherFacts = require('../knowledge/teacher_facts.json');

const teacherFactsPath = path.join(__dirname, '..', 'knowledge', 'teacher_facts.json');
const teacherKnowledge = loadTeacherKnowledge(teacherFactsPath);
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
], teacherKnowledge.length ? teacherKnowledge : teacherFacts.items);

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

const questionAnswer = createQuestionAnswerService({
  teacherFactsFile: teacherFactsPath,
  maxKnowledgeItems: 8,
  loadTeacherKnowledge: () => teacherKnowledge,
  loadKnowledgeGraph: () => graph,
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama: {
    buildTeacherPrompt: () => '',
    stream: async () => {}
  },
  logProblem: () => {},
  logStudentInteraction: () => {},
  initialTeacherKnowledge: teacherKnowledge,
  initialKnowledgeGraph: graph
});

const speedVelocityRoute = questionAnswer.routeMessage('How are speed and velocity related?').questionRoute;
assert.ok(speedVelocityRoute.graphContext, 'route metadata should include graphContext for speed/velocity');
assert.equal(speedVelocityRoute.graphContext.aiAllowed, false, 'graph context must not allow AI fallback');
assert.ok(speedVelocityRoute.public.graphContext, 'public route metadata should include graphContext');
assert.ok(
  includesNodeLabel(speedVelocityRoute.graphContext.matchedNodes, 'speed'),
  'route graphContext should include matched speed node'
);
assert.ok(
  includesNodeLabel(speedVelocityRoute.graphContext.matchedNodes, 'velocity'),
  'route graphContext should include matched velocity node'
);

const displacementVelocityRoute = questionAnswer.routeMessage('How are displacement and velocity connected?').questionRoute;
assert.ok(displacementVelocityRoute.graphContext, 'route metadata should include graphContext for displacement/velocity');
assert.equal(displacementVelocityRoute.graphContext.aiAllowed, false, 'displacement/velocity graph context must not allow AI');
assert.ok(
  includesNodeLabel(displacementVelocityRoute.graphContext.matchedNodes, 'displacement'),
  'route graphContext should include matched displacement node'
);
assert.ok(
  includesNodeLabel(displacementVelocityRoute.graphContext.matchedNodes, 'velocity'),
  'route graphContext should include matched velocity node'
);
assert.ok(
  displacementVelocityRoute.graphContext.possiblePaths.length > 0,
  'route graphContext should include a displacement/velocity path'
);

const formulaQuestion = 'A car travels 100 m in 20 s. What is its speed?';
const plainFormulaRoute = routeStudentQuestion(formulaQuestion, findRelevantKnowledge(formulaQuestion, teacherKnowledge, 8));
const graphFormulaRoute = questionAnswer.routeMessage(formulaQuestion).questionRoute;
assert.equal(graphFormulaRoute.type, 'science_formula', 'formula question should still route as science_formula');
assert.equal(graphFormulaRoute.confidence, plainFormulaRoute.confidence, 'formula route confidence should be unchanged');
assert.equal(graphFormulaRoute.directAnswer, plainFormulaRoute.directAnswer, 'formula answer text should be unchanged');
assert.deepEqual(graphFormulaRoute.public.formulaWork, plainFormulaRoute.public.formulaWork, 'public formula work should be unchanged');
assert.equal(graphFormulaRoute.aiAllowed, false, 'formula route should keep aiAllowed false');

assert.equal(canStartFormulaTutor(graphFormulaRoute), true, 'formula tutor should still be able to start');
const plainTutorProblem = startFormulaTutor({
  questionRoute: plainFormulaRoute,
  originalQuestion: formulaQuestion
});
const graphTutorProblem = startFormulaTutor({
  questionRoute: graphFormulaRoute,
  originalQuestion: formulaQuestion
});
assert.deepEqual(
  stripGraphTutorSupport(stripTutorTimestamps(graphTutorProblem)),
  stripTutorTimestamps(plainTutorProblem),
  'graph metadata should not change formula tutor steps or work'
);
assert.ok(graphTutorProblem.graphTutorSupport, 'formula tutor state should carry graph tutor support metadata');
assert.equal(
  buildFormulaTutorPrompt(graphTutorProblem),
  buildFormulaTutorPrompt(plainTutorProblem),
  'formula tutor should start with the same first prompt'
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

function stripTutorTimestamps(problem) {
  const clone = JSON.parse(JSON.stringify(problem));
  delete clone.startedAt;
  delete clone.updatedAt;
  return clone;
}

function stripGraphTutorSupport(problem) {
  const clone = JSON.parse(JSON.stringify(problem));
  delete clone.graphTutorSupport;
  return clone;
}

console.log('Knowledge graph tests passed.');
