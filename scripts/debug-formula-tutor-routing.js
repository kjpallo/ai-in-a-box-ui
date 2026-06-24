const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../lib/router/questionRouter');
const { createQuestionAnswerService } = require('../lib/server/questionAnswerService');
const {
  getFormulaTutorDecisionDebug,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');

const projectRoot = path.join(__dirname, '..');
const teacherFactsFile = path.join(projectRoot, 'knowledge', 'teacher_facts.json');

const samples = [
  {
    label: 'SOCCER',
    question: 'If a soccer player runs after his opponent 50 m north, then turns around and chases him 20 m south, what is his distance and displacement?'
  },
  {
    label: 'TRUCK 2D',
    question: 'A delivery truck drives 4 miles west before turning right and driving 6 miles north to make a delivery. Find the delivery truck\u2019s distance and displacement.'
  },
  {
    label: 'TAYLOR',
    question: 'On the way home from school, Taylor\u2019s car runs out of gas. He has to walk 25 m north and 10 m west in order to reach the nearest gas station. Find his distance traveled and his displacement from his car.'
  },
  {
    label: 'BLOCKS',
    question: 'A delivery truck travels 18 blocks north, 10 blocks east, and 16 blocks south. What is the distance traveled and displacement?'
  },
  {
    label: 'PJ LOOP',
    question: 'PJ likes to ride his bike around the block. If he rides out of his house west, the sidewalk circles his block, and brings him back to his doorstep 0.35 miles later. Find his distance and displacement.'
  },
  {
    label: 'MALI SPIN',
    question: 'Mali loves to make herself dizzy. She spins around in place 7 times before falling down right where she was standing. Find her distance and displacement.'
  },
  {
    label: 'KAI SWIM',
    question: 'Kai swims for the school swim team. He specializes in a backstroke event where he has to swim the 50-m length of the pool three times. Find his distance and displacement.'
  },
  {
    label: 'NET FORCE A',
    question: 'A 2 N and an 8 N force pull on an object to the right and a 4 N force pulls on the object to the left. If the object has a mass of .5 kg what is its acceleration?'
  },
  {
    label: 'BOULDER FG',
    question: 'If a 53 kg boulder falls off a cliff, what is the force with which it will hit the ground?'
  },
  {
    label: 'RUNNER FORCE',
    question: 'A runner has a speed of 25 m/s. They see the finish line and speed up to 30 m/s. This happens in 5 seconds. If the runner has a mass of 75 kg, with what force did the runner cross the finish line? Show all work to receive full credit.'
  },
  {
    label: 'TRUCK MASS',
    question: 'What is the mass of a truck that has a momentum of 10,000 kg*m/s and a velocity of 4 m/s North?'
  },
  {
    label: 'TRANSFER',
    question: 'In a collision, a 25 kg ball moving at 3 m/s transfers all of its momentum to a 5 kg ball. What is the velocity of the 5 kg ball after the collision?'
  },
  {
    label: 'BIKE BOTH',
    question: 'A man and his bike are 95 kg. His instantaneous speed at one point is 14m/s. The next time his speed is checked he is going 28m/s. If the second speed was taken 7 seconds later, what force must the man have given his bike to change the speed? What was the bicyclist\'s final momentum?'
  }
];

function createService() {
  return createQuestionAnswerService({
    teacherFactsFile,
    maxKnowledgeItems: 6,
    loadTeacherKnowledge,
    findRelevantKnowledge,
    routeStudentQuestion,
    ollama: {
      async stream() {
        throw new Error('AI fallback should not be used by formula tutor routing debug.');
      },
      buildTeacherPrompt() {
        return '';
      }
    },
    logProblem() {},
    logStudentInteraction() {},
    initialTeacherKnowledge: loadTeacherKnowledge(teacherFactsFile)
  });
}

async function buildRow(questionAnswer, sample) {
  const result = await questionAnswer.answerStudentMessage(sample.question, {
    recentMessages: []
  });
  const decisionBeforeStart = getFormulaTutorDecisionDebug(result, {
    studentGuidedFormulaTutoringEnabled: true
  });
  const tutorProblem = decisionBeforeStart.guidedFormulaTutoringEnabled && decisionBeforeStart.canStartFormulaTutor
    ? startFormulaTutor({
      questionRoute: result.questionRoute,
      originalQuestion: sample.question
    })
    : null;
  const decision = getFormulaTutorDecisionDebug(result, {
    studentGuidedFormulaTutoringEnabled: true,
    startedTutor: Boolean(tutorProblem)
  });

  return {
    label: sample.label,
    routeFormula: formatRouteFormula(decision),
    steps: String(decision.formulaWorkStepCount),
    canStart: String(decision.canStartFormulaTutor),
    tutor: decision.startedTutor ? 'yes' : 'no',
    bypassReason: decision.bypassReason || '-'
  };
}

function formatRouteFormula(decision) {
  const formula = decision.formulaId || decision.formulaKey || '';
  if (!formula) return decision.routeType || '-';
  return `${decision.routeType || '-'} / ${formula.replace(/_/g, '-')}`;
}

function printTable(rows) {
  const headers = [
    'question',
    'route/formula detected',
    'formulaWork steps count',
    'canStartFormulaTutor',
    'starts tutor',
    'bypassReason'
  ];
  const values = rows.map((row) => [
    row.label,
    row.routeFormula,
    row.steps,
    row.canStart,
    row.tutor,
    row.bypassReason
  ]);
  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...values.map((row) => row[index].length)
  ));

  console.log(formatTableRow(headers, widths));
  console.log(widths.map((width) => '-'.repeat(width)).join('-|-'));
  for (const row of values) {
    console.log(formatTableRow(row, widths));
  }
}

function formatTableRow(values, widths) {
  return values.map((value, index) => value.padEnd(widths[index])).join(' | ');
}

async function main() {
  const questionAnswer = createService();
  const rows = [];
  for (const sample of samples) {
    rows.push(await buildRow(questionAnswer, sample));
  }
  printTable(rows);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
