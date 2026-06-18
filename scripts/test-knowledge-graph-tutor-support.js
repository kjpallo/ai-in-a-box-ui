const assert = require('node:assert/strict');
const path = require('node:path');

const { buildKnowledgeGraph } = require('../lib/knowledge/knowledgeGraph');
const {
  findRelevantKnowledge,
  loadTeacherKnowledge
} = require('../lib/knowledge/teacherKnowledge');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  buildFormulaTutorPrompt,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');
const {
  buildGraphTutorHint,
  buildGraphTutorSupport,
  summarizePrerequisites
} = require('../lib/tutor/graphTutorSupport');
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

const questionAnswer = createQuestionAnswerService({
  teacherFactsFile: teacherFactsPath,
  maxKnowledgeItems: 8,
  loadTeacherKnowledge: () => teacherKnowledge,
  loadKnowledgeGraph: () => graph,
  findRelevantKnowledge,
  routeStudentQuestion,
  ollama: {
    buildTeacherPrompt: () => '',
    stream: async () => {
      throw new Error('AI fallback should not be used in graph tutor support tests.');
    }
  },
  logProblem: () => {},
  logStudentInteraction: () => {},
  initialTeacherKnowledge: teacherKnowledge,
  initialKnowledgeGraph: graph
});

const speedVelocityDistanceTimeSupport = buildGraphTutorSupport({}, {
  aiAllowed: false,
  matchedNodes: [
    conceptNode('speed', 'vocabulary'),
    conceptNode('velocity', 'vocabulary'),
    conceptNode('distance', 'vocabulary'),
    conceptNode('time', 'concept')
  ],
  relatedNodes: [],
  edges: [
    graphEdge('speed', 'velocity', 'related_to'),
    graphEdge('speed', 'distance', 'uses_concept'),
    graphEdge('speed', 'time', 'uses_concept')
  ],
  possiblePaths: []
});
assert.equal(speedVelocityDistanceTimeSupport.aiAllowed, false);
assert.equal(speedVelocityDistanceTimeSupport.source, 'approved_knowledge_graph');
assertConceptLabelsInclude(
  speedVelocityDistanceTimeSupport.connectedConcepts,
  ['speed', 'velocity', 'distance', 'time'],
  'speed/velocity/distance/time support should include connected concepts'
);

const velocityRoute = questionAnswer.routeMessage('How are velocity, displacement, and time connected?').questionRoute;
const velocitySupport = buildGraphTutorSupport(velocityRoute, velocityRoute.graphContext);
assertConceptLabelsInclude(
  velocitySupport.prerequisiteConcepts,
  ['displacement', 'time'],
  'velocity support should include displacement and time prerequisites'
);
assert.match(
  summarizePrerequisites(velocitySupport, { target: 'velocity' }),
  /Before solving velocity, make sure you know displacement and time\./
);

const speedVelocityRoute = questionAnswer.routeMessage('How are speed and velocity related?').questionRoute;
const speedVelocitySupport = buildGraphTutorSupport(speedVelocityRoute, speedVelocityRoute.graphContext);
assert.ok(
  speedVelocitySupport.commonMisconceptions.some((entry) => /velocity includes direction/i.test(entry.warning)),
  'speed/velocity support should include a misconception warning'
);

const formulaQuestion = 'A car travels 100 m in 20 s. What is its speed?';
const plainFormulaRoute = routeStudentQuestion(
  formulaQuestion,
  findRelevantKnowledge(formulaQuestion, teacherKnowledge, 8)
);
const graphFormulaRoute = questionAnswer.routeMessage(formulaQuestion).questionRoute;
const plainTutorProblem = startFormulaTutor({
  questionRoute: plainFormulaRoute,
  originalQuestion: formulaQuestion
});
const graphTutorProblem = startFormulaTutor({
  questionRoute: graphFormulaRoute,
  originalQuestion: formulaQuestion
});

assert.ok(graphTutorProblem.graphTutorSupport, 'formula tutor should start with graphTutorSupport attached');
assert.equal(graphTutorProblem.graphTutorSupport.aiAllowed, false);
assert.equal(graphTutorProblem.graphTutorSupport.source, 'approved_knowledge_graph');
assert.equal(plainTutorProblem.graphTutorSupport, undefined, 'no graphContext should not add tutor graph metadata');
assert.equal(
  graphTutorProblem.steps[0].prompt,
  plainTutorProblem.steps[0].prompt,
  'first required student step should be unchanged'
);
assert.equal(
  buildFormulaTutorPrompt(graphTutorProblem),
  buildFormulaTutorPrompt(plainTutorProblem),
  'first formula tutor prompt should be unchanged'
);

const graphMetadata = buildFormulaTutorMetadata(graphTutorProblem);
assert.ok(graphMetadata.graphTutorSupport, 'formula tutor metadata should include graphTutorSupport');
assert.equal(graphMetadata.graphTutorSupport.aiAllowed, false);

const plainMetadata = buildFormulaTutorMetadata(plainTutorProblem);
assert.equal(plainMetadata.graphTutorSupport, undefined, 'plain tutor metadata should not include graphTutorSupport');

const wrongPlain = answerFormulaTutorStep(plainTutorProblem, 'distance');
const wrongGraph = answerFormulaTutorStep(graphTutorProblem, 'distance');
assert.match(wrongGraph.response, /Not quite yet\./);
assert.equal(wrongGraph.response, wrongPlain.response, 'wrong answer feedback should stay unchanged');

const hintPlain = answerFormulaTutorStep(plainTutorProblem, 'hint');
const hintGraph = answerFormulaTutorStep(graphTutorProblem, 'hint');
assert.ok(
  hintGraph.response.includes(hintPlain.response),
  'graph hint should preserve existing tutor hint behavior'
);
assert.notEqual(hintGraph.response, hintPlain.response, 'graph hint may add one scaffold line');
assert.match(hintGraph.response, /Watch out:|Helpful connection:|Before solving/i);

const whyGraph = answerFormulaTutorStep(graphTutorProblem, "what's the point");
assert.match(whyGraph.response, /This matters because/i);
assert.match(whyGraph.response, /Step 1 of 5:/);

const whyPlain = answerFormulaTutorStep(plainTutorProblem, "what's the point");
assert.match(whyPlain.response, /Not quite yet\./, 'no graphContext should behave like the existing tutor path');
assert.equal(whyPlain.currentTutorProblem.graphTutorSupport, undefined);

assertProgressionUnchanged(plainTutorProblem, graphTutorProblem, [
  'speed',
  '1',
  '100 m',
  '20 s',
  '5'
]);

const velocityAccelerationSupport = buildGraphTutorSupport({}, {
  aiAllowed: false,
  matchedNodes: [conceptNode('velocity', 'vocabulary')],
  relatedNodes: [conceptNode('acceleration', 'vocabulary')],
  edges: [graphEdge('acceleration', 'velocity', 'uses_concept')],
  possiblePaths: []
});
const whyLine = buildGraphTutorHint({ solveFor: 'velocity' }, velocityAccelerationSupport, {
  message: "what's the point",
  intent: 'why_it_matters'
});
assert.match(whyLine, /This matters because velocity is used to understand acceleration\./);

console.log('Knowledge graph tutor support tests passed.');
console.log('\nExample graphTutorSupport metadata:');
console.log(JSON.stringify({
  connectedConcepts: graphTutorProblem.graphTutorSupport.connectedConcepts.slice(0, 3),
  prerequisiteConcepts: velocitySupport.prerequisiteConcepts,
  commonMisconceptions: speedVelocitySupport.commonMisconceptions.slice(0, 2),
  whyItMatters: velocitySupport.whyItMatters.slice(0, 2),
  aiAllowed: graphTutorProblem.graphTutorSupport.aiAllowed,
  source: graphTutorProblem.graphTutorSupport.source
}, null, 2));
console.log('\nFormula tutor stability proof: first prompt and correct-step responses matched plain tutor.');

function assertConceptLabelsInclude(concepts, expectedLabels, message) {
  const labels = concepts.map((concept) => normalizeLabel(concept.label));
  expectedLabels.forEach((label) => {
    assert.ok(labels.includes(normalizeLabel(label)), `${message}: missing ${label}`);
  });
}

function assertProgressionUnchanged(plainStart, graphStart, replies) {
  let plain = clonePlain(plainStart);
  let graph = clonePlain(graphStart);

  replies.forEach((reply, index) => {
    const plainResult = answerFormulaTutorStep(plain, reply);
    const graphResult = answerFormulaTutorStep(graph, reply);
    assert.equal(graphResult.response, plainResult.response, `correct response ${index + 1} should be unchanged`);
    assert.equal(graphResult.completed, plainResult.completed, `completion flag ${index + 1} should be unchanged`);
    assert.equal(graphResult.stopped, plainResult.stopped, `stop flag ${index + 1} should be unchanged`);

    plain = plainResult.currentTutorProblem || plainResult.completedTutorProblem;
    graph = graphResult.currentTutorProblem || graphResult.completedTutorProblem;
    assert.equal(
      graph?.currentStepIndex,
      plain?.currentStepIndex,
      `current step index ${index + 1} should be unchanged`
    );
  });
}

function normalizeLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function conceptNode(label, type = 'concept') {
  return {
    id: label,
    type,
    label,
    matchedTerm: label
  };
}

function graphEdge(from, to, type) {
  return {
    from,
    to,
    type,
    label: type.replace(/_/g, ' '),
    confidence: 'high'
  };
}
