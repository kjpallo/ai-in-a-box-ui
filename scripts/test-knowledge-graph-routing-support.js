const assert = require('node:assert/strict');
const path = require('node:path');

const { buildKnowledgeGraph, normalizeGraphTerm } = require('../lib/knowledge/knowledgeGraph');
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
], teacherKnowledge);

assertGraphEdge('force', 'motion', 'can change');
assertGraphEdge('unbalanced force', 'acceleration', 'causes');
assertGraphEdge('unbalanced force', 'change in motion', 'causes');
assertGraphEdge('balanced forces', '0 net force', 'net force');
assertGraphEdge("Newton's First Law", 'inertia', 'related to');
assertGraphEdge('inertia', 'mass', 'increases with');
assertGraphEdge('friction', 'motion', 'opposes');
assertGraphEdge('air resistance', 'motion through air', 'opposes');
assertGraphEdge('air resistance', 'speed', 'affected by');
assertGraphEdge('air resistance', 'shape and frontal area', 'affected by');
assertGraphEdge('air resistance', 'air or fluid conditions', 'affected by');
assertGraphEdge('gravity', 'Earth', 'pulls objects toward');
assertGraphEdge('free fall', 'acceleration due to gravity', 'constant acceleration');
assertGraphEdge('free fall', 'constant velocity', 'not constant velocity');
assertGraphEdge('terminal velocity', 'gravity and air resistance are balanced', 'occurs when');
assertGraphEdge('normal force', 'support force', 'is');
assertGraphEdge('normal force', 'weight', 'balances when supported');
assertGraphEdge("Newton's Second Law", 'F = m × a', 'formula');
assertGraphEdge("Newton's Third Law", 'action-reaction forces', 'equal and opposite');
assertGraphEdge("Newton's Third Law", 'trampoline', 'person pushes down, trampoline pushes up');
assertGraphEdge('momentum', 'mass in motion', 'is');
assertGraphEdge('momentum', 'force needed to change motion', 'class key');
assertGraphEdge('inertia', 'tendency to resist changes in motion', 'definition');
assertGraphEdge('conservation of momentum', 'momentum transferred in collision', 'means');
assertGraphEdge('mass', 'weight', 'different from');
assertGraphEdge('weight', 'force of gravity', 'is');

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

(async () => {
  const beforeAcceleration = await questionAnswer.answerStudentMessage('What do I need to know before acceleration?');
  assertGraphSupport(beforeAcceleration, 'prerequisite');
  assert.match(beforeAcceleration.response, /Before acceleration/i);
  assert.match(beforeAcceleration.response, /velocity and time/i);
  assert.deepEqual(
    beforeAcceleration.questionRoute.graphRoutingSupportAnswer.prerequisiteConcepts.slice(0, 2),
    ['velocity', 'time']
  );

  const beforeVelocity = await questionAnswer.answerStudentMessage('What should I understand before velocity?');
  assertGraphSupport(beforeVelocity, 'prerequisite');
  assert.match(beforeVelocity.response, /displacement and time/i);
  assert.deepEqual(
    beforeVelocity.questionRoute.graphRoutingSupportAnswer.prerequisiteConcepts.slice(0, 2),
    ['displacement', 'time']
  );

  const distanceDisplacementMixup = await questionAnswer.answerStudentMessage('I keep mixing up distance and displacement');
  assertGraphSupport(distanceDisplacementMixup, 'misconception');
  assert.match(distanceDisplacementMixup.response, /common mix-up/i);
  assert.match(distanceDisplacementMixup.response, /Distance is the total path traveled/i);
  assert.match(distanceDisplacementMixup.response, /zero displacement/i);
  assert.match(distanceDisplacementMixup.response, /commonly confused with/i);

  const distanceDisplacementSame = await questionAnswer.answerStudentMessage('Are distance and displacement the same?');
  assertGraphSupport(distanceDisplacementSame, 'misconception');
  assert.match(distanceDisplacementSame.response, /Distance is the total path traveled/i);
  assert.match(distanceDisplacementSame.response, /displacement is the change from start to finish/i);

  const displacementMatters = await questionAnswer.answerStudentMessage('Why does displacement matter?');
  assertGraphSupport(displacementMatters, 'why_matters');
  assert.match(displacementMatters.response, /Displacement matters/i);
  assert.match(displacementMatters.response, /velocity/i);

  const netForceMatters = await questionAnswer.answerStudentMessage('Why does net force matter?');
  assertGraphSupport(netForceMatters, 'why_matters');
  assert.match(netForceMatters.response, /Net force matters/i);
  assert.match(netForceMatters.response, /balanced/i);
  assert.match(netForceMatters.response, /unbalanced/i);
  assert.match(netForceMatters.response, /accelerates/i);

  const formulaQuestion = 'A car travels 100 m in 20 s. What is its speed?';
  const plainFormulaRoute = routeStudentQuestion(formulaQuestion, findRelevantKnowledge(formulaQuestion, teacherKnowledge, 8));
  const graphFormulaRoute = questionAnswer.routeMessage(formulaQuestion).questionRoute;
  assert.equal(graphFormulaRoute.type, 'science_formula');
  assert.equal(graphFormulaRoute.confidence, plainFormulaRoute.confidence);
  assert.equal(graphFormulaRoute.directAnswer, plainFormulaRoute.directAnswer);
  assert.deepEqual(graphFormulaRoute.formulaWork, plainFormulaRoute.formulaWork);
  assert.deepEqual(graphFormulaRoute.public.formulaWork, plainFormulaRoute.public.formulaWork);
  assert.equal(graphFormulaRoute.aiAllowed, false);
  assert.equal(graphFormulaRoute.graphRoutingSupportAnswer, undefined);

  const formulaAnswer = await questionAnswer.answerStudentMessage(formulaQuestion);
  assert.equal(formulaAnswer.routeType, 'science_formula');
  assert.equal(formulaAnswer.response, plainFormulaRoute.directAnswer);

  const velocityTimeSlope = await questionAnswer.answerStudentMessage('velocity vs. time graph, the slope of the line equals the object’s');
  assert.equal(velocityTimeSlope.routeType, 'graph_concept');
  assert.notEqual(velocityTimeSlope.routeType, 'knowledge_graph_support');
  assert.match(velocityTimeSlope.response, /slope means acceleration/i);
  assert.equal(velocityTimeSlope.questionRoute.graphRoutingSupportAnswer, undefined);

  const distanceTimeSlope = await questionAnswer.answerStudentMessage('On a distance vs. time graph, the slope of the line equals the object’s');
  assert.equal(distanceTimeSlope.routeType, 'graph_concept');
  assert.notEqual(distanceTimeSlope.routeType, 'knowledge_graph_support');
  assert.match(distanceTimeSlope.response, /slope means speed/i);
  assert.equal(distanceTimeSlope.questionRoute.graphRoutingSupportAnswer, undefined);

  const positiveAccelerationGraph = await questionAnswer.answerStudentMessage('Positive acceleration look like on a speed vs time graph');
  assert.equal(positiveAccelerationGraph.routeType, 'graph_concept');
  assert.notEqual(positiveAccelerationGraph.routeType, 'knowledge_graph_support');
  assert.match(positiveAccelerationGraph.response, /upward or increasing line/i);
  assert.equal(positiveAccelerationGraph.questionRoute.graphRoutingSupportAnswer, undefined);

  const negativeAccelerationGraph = await questionAnswer.answerStudentMessage('Negative acceleration looks like what on a speed vs time graph');
  assert.equal(negativeAccelerationGraph.routeType, 'graph_concept');
  assert.notEqual(negativeAccelerationGraph.routeType, 'knowledge_graph_support');
  assert.match(negativeAccelerationGraph.response, /downward or decreasing line/i);
  assert.equal(negativeAccelerationGraph.questionRoute.graphRoutingSupportAnswer, undefined);

  assert.equal(canStartFormulaTutor(graphFormulaRoute), true);
  const plainTutorProblem = startFormulaTutor({
    questionRoute: plainFormulaRoute,
    originalQuestion: formulaQuestion
  });
  const graphTutorProblem = startFormulaTutor({
    questionRoute: graphFormulaRoute,
    originalQuestion: formulaQuestion
  });
  assert.deepEqual(stripGraphTutorSupport(stripTutorTimestamps(graphTutorProblem)), stripTutorTimestamps(plainTutorProblem));
  assert.ok(graphTutorProblem.graphTutorSupport, 'formula tutor should still carry graph tutor support metadata');
  assert.equal(
    buildFormulaTutorPrompt(graphTutorProblem),
    buildFormulaTutorPrompt(plainTutorProblem)
  );

  const accelerationDefinition = await questionAnswer.answerStudentMessage('What is acceleration?');
  assert.equal(accelerationDefinition.routeType, 'definition');
  assert.notEqual(accelerationDefinition.routeType, 'knowledge_graph_support');
  assert.match(accelerationDefinition.response, /Acceleration is the rate that velocity changes over time/i);

  const vagueUnsupported = await questionAnswer.answerStudentMessage('I do not get quantum bananas');
  assert.notEqual(vagueUnsupported.routeType, 'knowledge_graph_support');
  assert.equal(vagueUnsupported.routeType, 'no_match');

  const relationshipGraphAnswer = await questionAnswer.answerStudentMessage('How are speed and velocity related?');
  assert.equal(relationshipGraphAnswer.routeType, 'knowledge_graph_answer');
  assert.match(relationshipGraphAnswer.response, /Speed and velocity are related/i);
  assert.match(relationshipGraphAnswer.response, /Connection:/);

  const localConcept3Relationship = await questionAnswer.answerStudentMessage('how is momentum related to newton 3rd law');
  assert.equal(localConcept3Relationship.routeType, 'science_concept');
  assert.notEqual(localConcept3Relationship.routeType, 'knowledge_graph_answer');
  assert.match(localConcept3Relationship.response, /momentum is transferred/i);
  assert.match(localConcept3Relationship.response, /Momentum is conserved/i);

  console.log('Knowledge graph routing support tests passed.');
  console.log('\nExample prerequisite answer:');
  console.log(beforeAcceleration.response);
  console.log('\nExample misconception answer:');
  console.log(distanceDisplacementMixup.response);
  console.log('\nExample why-matters answer:');
  console.log(netForceMatters.response);
})();

function assertGraphSupport(result, supportIntent) {
  assert.equal(result.routeType, 'knowledge_graph_support');
  assert.equal(result.questionRoute.type, 'knowledge_graph_support');
  assert.equal(result.questionRoute.aiAllowed, false);
  assert.equal(result.questionRoute.graphRoutingSupportAnswer.aiAllowed, false);
  assert.equal(result.questionRoute.graphRoutingSupportAnswer.source, 'approved_knowledge_graph');
  assert.equal(result.questionRoute.graphRoutingSupportAnswer.supportIntent, supportIntent);
}

function assertGraphEdge(fromLabel, toLabel, relationshipLabel) {
  const fromNodes = findGraphNodes(fromLabel);
  const toNodes = findGraphNodes(toLabel);
  assert.ok(fromNodes.length > 0, `Missing graph node: ${fromLabel}`);
  assert.ok(toNodes.length > 0, `Missing graph node: ${toLabel}`);

  const fromIds = new Set(fromNodes.map((node) => node.id));
  const toIds = new Set(toNodes.map((node) => node.id));
  const edge = graph.edges.find((candidate) =>
    fromIds.has(candidate.from) &&
    toIds.has(candidate.to) &&
    normalizeGraphTerm(candidate.label) === normalizeGraphTerm(relationshipLabel)
  );

  assert.ok(edge, `Missing graph edge: ${fromLabel} -> ${relationshipLabel} -> ${toLabel}`);
}

function findGraphNodes(label) {
  const normalized = normalizeGraphTerm(label);
  return Object.values(graph.nodes).filter((node) => normalizeGraphTerm(node.label) === normalized);
}

function stripTutorTimestamps(problem) {
  const clone = JSON.parse(JSON.stringify(problem));
  delete clone.startedAt;
  delete clone.updatedAt;
  delete clone.tutorProblemId;
  return clone;
}

function stripGraphTutorSupport(problem) {
  const clone = JSON.parse(JSON.stringify(problem));
  delete clone.graphTutorSupport;
  return clone;
}
