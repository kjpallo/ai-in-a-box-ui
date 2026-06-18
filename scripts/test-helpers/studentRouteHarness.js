const path = require('node:path');

const { findRelevantKnowledge, loadTeacherKnowledge } = require('../../lib/knowledge/teacherKnowledge');
const { routeStudentQuestion } = require('../../lib/router/questionRouter');
const { createQuestionAnswerService } = require('../../lib/server/questionAnswerService');
const { registerProfileRoutes } = require('../../routes/profileRoutes');
const {
  createStudentQuestionRateLimiter,
  getStudentRateLimitInfo,
  registerStudentRoutes
} = require('../../routes/studentRoutes');
const { createApp, request } = require('./httpHarness');
const { projectRoot } = require('./fileSystem');

const teacherFactsFile = path.join(projectRoot, 'knowledge', 'teacher_facts.json');

function createStudentRouteHarness(options = {}) {
  const handlers = new Map();
  const app = createApp(handlers, ['get', 'post']);
  const studentSessions = Object.create(null);
  const studentInteractionLog = [];
  const questionRateLimiter = createStudentQuestionRateLimiter(options.rateLimitClock ? { now: options.rateLimitClock } : undefined);
  const classroomControls = {
    studentCopyInspectLockEnabled: true,
    studentGuidedFormulaTutoringEnabled: options.studentGuidedFormulaTutoringEnabled !== false,
    studentQuestionRateLimitEnabled: options.studentQuestionRateLimitEnabled === true,
    studentQuestionsPerMinute: options.studentQuestionsPerMinute || 6
  };
  const questionAnswer = createQuestionAnswerService({
    teacherFactsFile,
    maxKnowledgeItems: 6,
    loadTeacherKnowledge,
    loadKnowledgeGraph: typeof options.loadKnowledgeGraph === 'function' ? options.loadKnowledgeGraph : null,
    findRelevantKnowledge,
    routeStudentQuestion,
    ollama: {
      async stream() {
        throw new Error('AI fallback should not be used in student session tests.');
      },
      buildTeacherPrompt() {
        return '';
      }
    },
    logProblem() {},
    logStudentInteraction(entry) {
      studentInteractionLog.push(entry);
    },
    initialTeacherKnowledge: loadTeacherKnowledge(teacherFactsFile),
    initialKnowledgeGraph: options.initialKnowledgeGraph || null
  });

  registerProfileRoutes(app, {
    clearGoogleIdentity() {},
    completeGoogleConnect() {},
    createGoogleConnectUrl() {},
    disconnectGoogle() {},
    getAvailableProfileDates() {
      return { dates: [] };
    },
    getClassroomControls: () => classroomControls,
    getDailyQuestionSummary() {
      return {};
    },
    getStudentRateLimitInfo,
    getStandardsSummaryReport() {
      return {};
    },
    getProfileStatus() {
      return {};
    },
    linkGoogleIdentity() {},
    port: 3000,
    questionRateLimiter,
    sendDailySummaryEmail() {},
    studentSessions
  });

  registerStudentRoutes(app, {
    answerStudentMessage: questionAnswer.answerStudentMessage,
    getClassroomControls: () => classroomControls,
    logCompletedInteraction: questionAnswer.logCompletedInteraction,
    questionRateLimiter,
    studentSessions
  });

  return {
    request(method, route, body = {}, query = {}) {
      return request(handlers, method, route, body, {}, query, {
        protocol: 'http',
        get(name) {
          return name === 'host' ? 'localhost:3000' : '';
        }
      });
    },
    questionAnswer,
    questionRateLimiter,
    studentInteractionLog,
    studentSessions,
    classroomControls
  };
}

module.exports = {
  createStudentRouteHarness,
  teacherFactsFile
};
