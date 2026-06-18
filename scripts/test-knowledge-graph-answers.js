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
  const speedVelocity = await questionAnswer.answerStudentMessage('How are speed and velocity related?');
  assert.equal(speedVelocity.routeType, 'knowledge_graph_answer');
  assert.equal(speedVelocity.questionRoute.aiAllowed, false);
  assert.match(speedVelocity.response, /Speed and velocity are related/i);
  assert.match(speedVelocity.response, /Connection: Speed -> related to -> Velocity/i);

  const displacementVelocity = await questionAnswer.answerStudentMessage('What is the connection between displacement and velocity?');
  assert.equal(displacementVelocity.routeType, 'knowledge_graph_answer');
  assert.ok(displacementVelocity.questionRoute.graphAnswer.graphPath, 'displacement/velocity answer should include a graph path');
  assert.match(displacementVelocity.response, /Connection:/);
  assert.match(displacementVelocity.response, /Displacement and velocity are connected/i);

  const distanceDisplacement = await questionAnswer.answerStudentMessage('What is the difference between distance and displacement?');
  assert.equal(distanceDisplacement.routeType, 'knowledge_graph_answer');
  assert.match(distanceDisplacement.response, /Distance is the total path traveled/i);
  assert.match(distanceDisplacement.response, /displacement is the change from start to finish/i);
  assert.match(distanceDisplacement.response, /Watch out:/);

  const formulaQuestion = 'A car travels 100 m in 20 s. What is its speed?';
  const plainFormulaRoute = routeStudentQuestion(formulaQuestion, findRelevantKnowledge(formulaQuestion, teacherKnowledge, 8));
  const graphFormulaRoute = questionAnswer.routeMessage(formulaQuestion).questionRoute;
  assert.equal(graphFormulaRoute.type, 'science_formula');
  assert.equal(graphFormulaRoute.confidence, plainFormulaRoute.confidence);
  assert.equal(graphFormulaRoute.directAnswer, plainFormulaRoute.directAnswer);
  assert.deepEqual(graphFormulaRoute.formulaWork, plainFormulaRoute.formulaWork);
  assert.deepEqual(graphFormulaRoute.public.formulaWork, plainFormulaRoute.public.formulaWork);
  assert.equal(graphFormulaRoute.aiAllowed, false);

  const formulaAnswer = await questionAnswer.answerStudentMessage(formulaQuestion);
  assert.equal(formulaAnswer.routeType, 'science_formula');
  assert.equal(formulaAnswer.response, plainFormulaRoute.directAnswer);

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
  assert.ok(graphTutorProblem.graphTutorSupport, 'formula tutor should carry graph tutor support metadata');
  assert.equal(
    buildFormulaTutorPrompt(graphTutorProblem),
    buildFormulaTutorPrompt(plainTutorProblem)
  );

  const accelerationDefinition = await questionAnswer.answerStudentMessage('What is acceleration?');
  assert.notEqual(accelerationDefinition.routeType, 'knowledge_graph_answer');
  assert.equal(accelerationDefinition.routeType, 'definition');
  assert.match(accelerationDefinition.response, /Acceleration is the rate that velocity changes over time/i);

  const unsupportedRelationship = await questionAnswer.answerStudentMessage('How are flurbs and zorts related?');
  assert.notEqual(unsupportedRelationship.routeType, 'knowledge_graph_answer');
  assert.equal(unsupportedRelationship.routeType, 'no_match');

  console.log('Knowledge graph answer tests passed.');
  console.log('\nExample graph answer:');
  console.log(speedVelocity.response);
})();

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
