const { isInstructionalFollowUpPrompt } = require('../lib/standards/standardsFollowUp');
const {
  answerConceptTutorStep,
  buildConceptTutorMetadata,
  buildConceptTutorPrompt,
  isConceptTutorProblem,
  startConceptTutor
} = require('../lib/tutor/conceptTutor/conceptTutorEngine');
const {
  buildAccelerationConceptTutorPattern,
  buildAcidsBasesConceptTutorPattern,
  buildBalancedUnbalancedForcesConceptTutorPattern,
  buildDistanceDisplacementConceptTutorPattern,
  buildElementCompoundMixtureConceptTutorPattern,
  buildEndothermicExothermicConceptTutorPattern,
  buildEnergyTransferConceptTutorPattern,
  buildMechanicalElectromagneticWavesConceptTutorPattern,
  buildMechanicalEnergyTypesConceptTutorPattern,
  buildMixtureConceptTutorPattern,
  buildNewtonsLawsConceptTutorPattern,
  buildOpenClosedCircuitsConceptTutorPattern,
  buildPhysicalChemicalChangeConceptTutorPattern,
  buildReflectionRefractionAbsorptionConceptTutorPattern,
  buildReferencePointConceptTutorPattern,
  buildSeriesParallelCircuitsConceptTutorPattern,
  buildSpeedVelocityConceptTutorPattern,
  buildTransverseLongitudinalWavesConceptTutorPattern,
  buildUnit1GraphingAxisConceptTutorPattern,
  buildUnit1VariablesConceptTutorPattern,
  buildUnit7AtomicStructureConceptTutorPattern,
  buildWavePropertiesConceptTutorPattern
} = require('../lib/tutor/conceptTutor/conceptTutorPatterns');
const {
  answerFormulaTutorStep,
  buildFormulaTutorMetadata,
  buildFormulaTutorPrompt,
  getFormulaTutorDecisionDebug,
  isLikelyNewFormulaQuestionDuringTutor,
  startFormulaTutor
} = require('../lib/tutor/formulaTutor');
const {
  buildMotionForceKnowledgeTutorMetadata,
  continueMotionForceKnowledgeTutor,
  isMotionForceKnowledgeTutorProblem
} = require('../lib/tutor/motionForceKnowledgeTutor');
const { buildMotionForceFlashcardDeck } = require('../lib/knowledge/physics/motion-force/motionForceKnowledge');
const { detectAnswerRepresentationIntent } = require('../lib/router/answerIntent');
const {
  ACTIVITY_ACTION_PREFIX,
  isAmmoniaBalancingProblem,
  sanitizeBalancingActivityTranscriptMessage
} = require('../lib/tutor/activities/ammoniaBalancingActivity');
const {
  resolveActiveStudentSession,
  sendStudentSessionAccessError,
  studentSessionAccessFromRequest
} = require('../lib/server/studentSessionLifecycle');

function registerStudentRoutes(app, {
  answerStudentMessage,
  getClassroomControls = () => ({
    studentCopyInspectLockEnabled: true,
    studentGuidedFormulaTutoringEnabled: true,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 6
  }),
  logCompletedInteraction,
  studentSessions,
  now = () => new Date(),
  questionRateLimiter = createStudentQuestionRateLimiter()
}) {
  app.get('/api/student/controls', (req, res) => {
    const resolved = resolveActiveStudentSession(
      studentSessions,
      studentSessionAccessFromRequest(req, 'query'),
      { now: now() }
    );
    if (!resolved.ok) return sendStudentSessionAccessError(res, resolved);

    const controls = normalizeStudentControls(getClassroomControls());
    res.json({
      studentCopyInspectLockEnabled: controls.studentCopyInspectLockEnabled,
      studentQuestionRateLimitEnabled: controls.studentQuestionRateLimitEnabled,
      studentQuestionsPerMinute: controls.studentQuestionsPerMinute
    });
  });

  app.get('/api/student/rate-limit-status', (req, res) => {
    const studentHubId = String(req.query?.studentHubId || '').trim();
    const resolved = resolveActiveStudentSession(
      studentSessions,
      studentSessionAccessFromRequest(req, 'query'),
      { now: now() }
    );
    if (!resolved.ok) return sendStudentSessionAccessError(res, resolved);
    const session = resolved.session;
    const sessionId = session.sessionId;

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    touchAnonymousHub(session, studentHubId);
    const controls = normalizeStudentControls(getClassroomControls());
    res.json({
      rateLimit: getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      })
    });
  });

  app.post('/api/student/join', (req, res) => {
    const studentHubId = String(req.body?.studentHubId || '').trim();
    const resolved = resolveActiveStudentSession(
      studentSessions,
      studentSessionAccessFromRequest(req),
      { now: now() }
    );
    if (!resolved.ok) return sendStudentSessionAccessError(res, resolved);
    const session = resolved.session;
    const sessionId = session.sessionId;

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    const hub = touchAnonymousHub(session, studentHubId);
    const response = {
      ok: true,
      status: 'active',
      joinCode: resolved.joinCode || undefined,
      studentHub: {
        label: hub.label,
        firstSeenAt: hub.firstSeenAt,
        lastSeenAt: hub.lastSeenAt,
        messageCount: hub.messageCount
      }
    };
    if (resolved.matchedBy === 'legacySessionId') {
      response.sessionId = sessionId;
      response.classSessionId = sessionId;
    }
    res.json(response);
  });

  app.post('/api/student/message', async (req, res) => {
    const studentHubId = String(req.body?.studentHubId || '').trim();
    const message = String(req.body?.message || '').trim();
    const intent = String(req.body?.intent || '').trim();
    const resolved = resolveActiveStudentSession(
      studentSessions,
      studentSessionAccessFromRequest(req),
      { now: now() }
    );
    if (!resolved.ok) return sendStudentSessionAccessError(res, resolved);
    const session = resolved.session;
    const sessionId = session.sessionId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    if (!studentHubId) {
      return res.status(400).json({ error: 'Student hub id is required.' });
    }

    try {
      const hub = touchAnonymousHub(session, studentHubId);
      const controls = normalizeStudentControls(getClassroomControls());
      let rateLimitInfo = getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      });

      const contextMessages = hub.messages;
      const lastAnsweredContext = findLastAnsweredContext(contextMessages);
      closeInactiveFormulaTutorProblem(hub);

      if (message.startsWith(ACTIVITY_ACTION_PREFIX) && !isAmmoniaBalancingProblem(hub.currentTutorProblem)) {
        const transcriptMessage = 'Used the balancing workspace controls';
        const response = 'That balancing workspace is no longer active. Start the activity again to keep working.';
        const entry = appendStudentHubEntry({
          session,
          hub,
          message: transcriptMessage,
          response,
          routeType: 'tutor_control',
          confidence: 'strong',
          reportableForStandards: false
        });

        logCompletedInteraction({
          message: transcriptMessage,
          questionRoute: makeTutorControlRoute(entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          reportableForStandards: false,
          debug: {
            className: session.className || '',
            studentHubId,
            tutorControl: {
              active: false,
              stale: true
            }
          }
        });

        return res.json({
          response,
          routeType: 'tutor_control',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: null
        });
      }

      const tutorCelebrationFeedback = answerTutorCelebrationFeedback(message, contextMessages);
      if (!hub.currentTutorProblem && tutorCelebrationFeedback) {
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response: tutorCelebrationFeedback.response,
          routeType: 'app_feedback',
          confidence: 'strong',
          reportableForStandards: false
        });

        logCompletedInteraction({
          message,
          questionRoute: makeAppFeedbackRoute(tutorCelebrationFeedback.response, entry),
          answerGiven: tutorCelebrationFeedback.response,
          source: 'student',
          sessionId,
          reportableForStandards: false,
          debug: {
            className: session.className || '',
            studentHubId,
            appFeedback: {
              topic: 'tutor_celebration',
              recentTutorRouteType: tutorCelebrationFeedback.context.routeType || ''
            }
          }
        });

        return res.json({
          response: tutorCelebrationFeedback.response,
          routeType: 'app_feedback',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: null
        });
      }

      if (hub.currentTutorProblem && !controls.studentGuidedFormulaTutoringEnabled) {
        const stoppedTutorType = isConceptTutorProblem(hub.currentTutorProblem)
          ? 'concept_tutor'
          : isMotionForceKnowledgeTutorProblem(hub.currentTutorProblem)
          ? 'motion_force_knowledge_tutor'
          : 'formula_tutor';
        hub.currentTutorProblem = null;
        const response = stoppedTutorType === 'concept_tutor'
          ? 'Guided Concept tutoring is turned off right now. Ask your question again for a normal answer.'
          : stoppedTutorType === 'motion_force_knowledge_tutor'
          ? 'Guided General tutoring is turned off right now. Ask your question again for a normal answer.'
          : 'Guided formula tutoring is turned off right now. Ask your formula question again for a normal answer.';
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response,
          routeType: stoppedTutorType,
          confidence: 'strong'
        });

        logCompletedInteraction({
          message,
          questionRoute: stoppedTutorType === 'motion_force_knowledge_tutor'
            ? makeMotionForceKnowledgeTutorRoute(null, entry)
            : stoppedTutorType === 'concept_tutor'
              ? makeConceptTutorRoute(null, entry)
              : makeFormulaTutorRoute(null, entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          debug: {
            className: session.className || '',
            studentHubId,
            formulaTutor: {
              active: false,
              stopped: true,
              disabledByControl: true
            }
          }
        });

        return res.json({
          response,
          routeType: stoppedTutorType,
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: null
        });
      }

      const flashcardSessionResult = !hub.currentTutorProblem
        ? handleExistingFlashcardSessionMessage(hub, message)
        : { handled: false };
      if (flashcardSessionResult.handled) {
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response: flashcardSessionResult.response,
          routeType: 'flashcard_session',
          confidence: 'strong',
          reportableForStandards: false
        });

        logCompletedInteraction({
          message,
          questionRoute: makeFlashcardSessionRoute(flashcardSessionResult.session, entry),
          answerGiven: flashcardSessionResult.response,
          source: 'student',
          sessionId,
          reportableForStandards: false,
          debug: {
            className: session.className || '',
            studentHubId,
            flashcards: flashcardSessionDebug(flashcardSessionResult.session)
          }
        });

        return res.json({
          response: flashcardSessionResult.response,
          routeType: 'flashcard_session',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          flashcards: buildFlashcardSessionMetadata(flashcardSessionResult.session),
          flashcardSession: buildFlashcardSessionMetadata(flashcardSessionResult.session),
          tutor: null
        });
      }

      if (!hub.currentTutorProblem && isTutorStopCommand(message)) {
        const response = 'There is no active tutor to stop. You can ask a new question whenever you’re ready.';
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response,
          routeType: 'tutor_control',
          confidence: 'strong',
          reportableForStandards: false
        });

        logCompletedInteraction({
          message,
          questionRoute: makeTutorControlRoute(entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          reportableForStandards: false,
          debug: {
            className: session.className || '',
            studentHubId,
            tutorControl: {
              active: false,
              command: 'stop'
            }
          }
        });

        return res.json({
          response,
          routeType: 'tutor_control',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: null
        });
      }

      // Guided math/formula tutor messages are already inside a teacher-safe scaffold, so they do not spend question energy.
      if (hub.currentTutorProblem) {
        const previousTutorProblem = hub.currentTutorProblem;
        const previousTutorIsConcept = isConceptTutorProblem(previousTutorProblem);
        const previousTutorIsMotionForceKnowledge = isMotionForceKnowledgeTutorProblem(previousTutorProblem);
        if (isLikelyNewQuestionDuringTutor(message) && !isTutorCorrectionDuringTutor(message, previousTutorProblem)) {
          const result = await answerStudentMessage(message, {
            intent,
            lastAnsweredPrompt: lastAnsweredContext.prompt,
            lastAnsweredAnswer: lastAnsweredContext.answer,
            pendingClarification: null,
            currentStandardId: findLastStandardIdForCurrentContext(contextMessages),
            recentMessages: contextMessages
          });

          const formulaTutorDecision = getFormulaTutorDecisionDebug(result, { controls });

          if (formulaTutorDecision.guidedFormulaTutoringEnabled && formulaTutorDecision.canStartFormulaTutor) {
            hub.currentTutorProblem = startFormulaTutor({
              questionRoute: result.questionRoute,
              originalQuestion: message
            });
            const startedFormulaTutorDecision = getFormulaTutorDecisionDebug(result, {
              controls,
              startedTutor: true
            });
            logFormulaTutorDecisionDebug('student_message_new_tutor_question_started', startedFormulaTutorDecision);
            const response = [
              'It looks like you are starting a new problem. I’ll start a new Guided Formula Tutor problem for this question.',
              '',
              buildFormulaTutorPrompt(hub.currentTutorProblem)
            ].join('\n');
            const tutorMetadata = buildFormulaTutorMetadata(hub.currentTutorProblem, {
              latestStudentReply: message
            });
            const entry = appendStudentHubEntry({
              session,
              hub,
              message,
              response,
              routeType: 'formula_tutor',
              confidence: result.confidence,
              standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
              isStandardsFollowUp: Boolean(result.isStandardsFollowUp)
            });

            hub.pendingClarification = null;

            logCompletedInteraction({
              message,
              questionRoute: makeFormulaTutorRoute(hub.currentTutorProblem, entry),
              answerGiven: response,
              source: 'student',
              sessionId,
              debug: {
                className: session.className || '',
                studentHubId,
                formulaTutor: {
                  active: true,
                  restartedWithNewQuestion: true,
                  previousQuestion: previousTutorProblem.originalQuestion || ''
                },
                formulaTutorDecision: maybeFormulaTutorDecisionDebug(startedFormulaTutorDecision)
              }
            });

            return res.json({
              response,
              routeType: 'formula_tutor',
              confidence: result.confidence,
              rateLimit: rateLimitInfo,
              tutor: tutorMetadata
            });
          }

          const conceptPattern = buildStudentConceptTutorPattern(message);
          const conceptTutorProblem = shouldStartConceptTutorPattern(conceptPattern, result)
            ? startConceptTutor(conceptPattern, message)
            : null;
          if (conceptTutorProblem) {
            hub.currentTutorProblem = conceptTutorProblem;
            hub.pendingClarification = null;
            const response = buildConceptTutorPrompt(hub.currentTutorProblem);
            const tutorMetadata = buildConceptTutorMetadata(hub.currentTutorProblem, {
              latestStudentReply: message
            });
            const entry = appendStudentHubEntry({
              session,
              hub,
              message,
              response,
              routeType: 'concept_tutor',
              confidence: 'strong',
              standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
              isStandardsFollowUp: Boolean(result.isStandardsFollowUp),
              reportableForStandards: false
            });

            logCompletedInteraction({
              message,
              questionRoute: makeConceptTutorRoute(hub.currentTutorProblem, entry),
              answerGiven: response,
              source: 'student',
              sessionId,
              reportableForStandards: false,
              debug: {
                className: session.className || '',
                studentHubId,
                conceptTutor: {
                  active: true,
                  restartedWithNewQuestion: true,
                  previousQuestion: previousTutorProblem.originalQuestion || '',
                  patternId: hub.currentTutorProblem.id,
                  originalQuestion: hub.currentTutorProblem.originalQuestion || ''
                },
                formulaTutorDecision: maybeFormulaTutorDecisionDebug(formulaTutorDecision),
                previousTutorType: previousTutorIsConcept
                  ? 'concept'
                  : previousTutorIsMotionForceKnowledge ? 'motion_force_knowledge' : 'formula'
              }
            });

            return res.json({
              response,
              routeType: 'concept_tutor',
              confidence: 'strong',
              rateLimit: rateLimitInfo,
              tutor: tutorMetadata
            });
          }

          hub.currentTutorProblem = null;
          hub.pendingClarification = result.pendingClarification || null;
          logFormulaTutorDecisionDebug('student_message_new_tutor_question_bypassed', formulaTutorDecision);
          const entry = appendStudentHubEntry({
            session,
            hub,
            message,
            response: result.response,
            routeType: result.routeType,
            confidence: result.confidence,
            standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
            isStandardsFollowUp: Boolean(result.isStandardsFollowUp)
          });

          logCompletedInteraction({
            message,
            questionRoute: result.questionRoute || makeFormulaTutorRoute(null, entry),
            answerGiven: result.response,
            source: 'student',
            sessionId,
            debug: {
              className: session.className || '',
              studentHubId,
              formulaTutor: {
                active: false,
                stoppedForNewQuestion: true,
                previousQuestion: previousTutorProblem.originalQuestion || ''
              },
              formulaTutorDecision: maybeFormulaTutorDecisionDebug(formulaTutorDecision),
              previousTutorType: previousTutorIsConcept
                ? 'concept'
                : previousTutorIsMotionForceKnowledge ? 'motion_force_knowledge' : 'formula'
            }
          });

          return res.json({
            response: result.response,
            routeType: result.routeType,
            confidence: result.confidence,
            rateLimit: rateLimitInfo,
            tutor: null
          });
        }

        if (previousTutorIsConcept) {
          const tutorResult = answerConceptTutorStep(previousTutorProblem, message);
          hub.currentTutorProblem = tutorResult.completed || tutorResult.stopped
            ? null
            : tutorResult.currentTutorProblem;
          const tutorProblemForResponse = hub.currentTutorProblem || tutorResult.completedTutorProblem || previousTutorProblem;
          const tutorMetadata = buildConceptTutorMetadata(
            tutorProblemForResponse,
            {
              completed: tutorResult.completed,
              stopped: tutorResult.stopped,
              latestStudentReply: message
            }
          );

          const entry = appendStudentHubEntry({
            session,
            hub,
            message,
            response: tutorResult.response,
            routeType: 'concept_tutor',
            confidence: 'strong',
            contextPrompt: previousTutorProblem.originalQuestion || '',
            isTutorStep: true,
            reportableForStandards: false,
            tutorOriginalQuestion: previousTutorProblem.originalQuestion || ''
          });

          logCompletedInteraction({
            message,
            questionRoute: makeConceptTutorRoute(tutorProblemForResponse, entry),
            answerGiven: tutorResult.response,
            source: 'student',
            sessionId,
            isTutorStep: true,
            reportableForStandards: false,
            tutorOriginalQuestion: previousTutorProblem.originalQuestion || '',
            debug: {
              className: session.className || '',
              studentHubId,
              conceptTutor: {
                active: Boolean(hub.currentTutorProblem),
                completed: Boolean(tutorResult.completed),
                stopped: Boolean(tutorResult.stopped)
              }
            }
          });

          return res.json({
            response: tutorResult.response,
            routeType: 'concept_tutor',
            confidence: 'strong',
            rateLimit: rateLimitInfo,
            tutor: tutorMetadata
          });
        }

        if (previousTutorIsMotionForceKnowledge) {
          const tutorResult = continueMotionForceKnowledgeTutor(previousTutorProblem, message);
          hub.currentTutorProblem = tutorResult.currentTutorProblem;
          const tutorProblemForResponse = hub.currentTutorProblem || tutorResult.completedTutorProblem || previousTutorProblem;
          const tutorMetadata = buildMotionForceKnowledgeTutorMetadata(
            tutorProblemForResponse,
            { completed: tutorResult.completed, stopped: tutorResult.stopped }
          );

          const entry = appendStudentHubEntry({
            session,
            hub,
            message,
            response: tutorResult.response,
            routeType: 'motion_force_knowledge_tutor',
            confidence: 'strong',
            contextPrompt: previousTutorProblem.originalQuestion || '',
            isTutorStep: true,
            reportableForStandards: false,
            tutorOriginalQuestion: previousTutorProblem.originalQuestion || ''
          });

          logCompletedInteraction({
            message,
            questionRoute: makeMotionForceKnowledgeTutorRoute(tutorProblemForResponse, entry),
            answerGiven: tutorResult.response,
            source: 'student',
            sessionId,
            isTutorStep: true,
            reportableForStandards: false,
            tutorOriginalQuestion: previousTutorProblem.originalQuestion || '',
            debug: {
              className: session.className || '',
              studentHubId,
              motionForceKnowledgeTutor: {
                active: Boolean(hub.currentTutorProblem),
                completed: Boolean(tutorResult.completed),
                stopped: Boolean(tutorResult.stopped)
              }
            }
          });

          return res.json({
            response: tutorResult.response,
            routeType: 'motion_force_knowledge_tutor',
            confidence: 'strong',
            rateLimit: rateLimitInfo,
            tutor: tutorMetadata
          });
        }

        const tutorResult = answerFormulaTutorStep(previousTutorProblem, message);
        const transcriptMessage = sanitizeBalancingActivityTranscriptMessage(previousTutorProblem, message);
        hub.currentTutorProblem = tutorResult.completed || tutorResult.stopped
          ? null
          : tutorResult.currentTutorProblem;
        const tutorProblemForResponse = hub.currentTutorProblem || tutorResult.completedTutorProblem || previousTutorProblem;
        const tutorMetadata = buildFormulaTutorMetadata(
          tutorProblemForResponse,
          {
            completed: tutorResult.completed,
            stopped: tutorResult.stopped,
            latestStudentReply: transcriptMessage
          }
        );

        const entry = appendStudentHubEntry({
          session,
          hub,
          message: transcriptMessage,
          response: tutorResult.response,
          routeType: 'formula_tutor',
          confidence: 'strong',
          contextPrompt: previousTutorProblem.originalQuestion || '',
          isTutorStep: true,
          reportableForStandards: false,
          tutorOriginalQuestion: previousTutorProblem.originalQuestion || ''
        });

        logCompletedInteraction({
          message: transcriptMessage,
          questionRoute: makeFormulaTutorRoute(tutorProblemForResponse, entry),
          answerGiven: tutorResult.response,
          source: 'student',
          sessionId,
          isTutorStep: true,
          reportableForStandards: false,
          tutorOriginalQuestion: previousTutorProblem.originalQuestion || '',
          debug: {
            className: session.className || '',
            studentHubId,
            formulaTutor: {
              active: Boolean(hub.currentTutorProblem),
              completed: Boolean(tutorResult.completed),
              stopped: Boolean(tutorResult.stopped)
            }
          }
        });

        return res.json({
          response: tutorResult.response,
          routeType: 'formula_tutor',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: tutorMetadata
        });
      }

      const result = await answerStudentMessage(message, {
        intent,
        lastAnsweredPrompt: lastAnsweredContext.prompt,
        lastAnsweredAnswer: lastAnsweredContext.answer,
        pendingClarification: hub.pendingClarification || null,
        currentStandardId: findLastStandardIdForCurrentContext(contextMessages),
        recentMessages: contextMessages
      });
      const formulaTutorDecision = getFormulaTutorDecisionDebug(result, { controls });
      // Starting a guided math/formula tutor also bypasses energy; normal student questions still spend energy below.
      if (formulaTutorDecision.guidedFormulaTutoringEnabled && formulaTutorDecision.canStartFormulaTutor) {
        hub.currentTutorProblem = startFormulaTutor({
          questionRoute: result.questionRoute,
          originalQuestion: message
        });
        const startedFormulaTutorDecision = getFormulaTutorDecisionDebug(result, {
          controls,
          startedTutor: true
        });
        logFormulaTutorDecisionDebug('student_message_started', startedFormulaTutorDecision);
        const response = buildFormulaTutorPrompt(hub.currentTutorProblem);
        const tutorMetadata = buildFormulaTutorMetadata(hub.currentTutorProblem, {
          latestStudentReply: message
        });
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response,
          routeType: 'formula_tutor',
          confidence: result.confidence,
          standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
          isStandardsFollowUp: Boolean(result.isStandardsFollowUp)
        });

        hub.pendingClarification = null;

        logCompletedInteraction({
          message,
          questionRoute: makeFormulaTutorRoute(hub.currentTutorProblem, entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          debug: {
            className: session.className || '',
            studentHubId,
            originalRouteType: result.routeType,
            formulaTutorDecision: maybeFormulaTutorDecisionDebug(startedFormulaTutorDecision)
          }
        });

        return res.json({
          response,
          routeType: 'formula_tutor',
          confidence: result.confidence,
          rateLimit: rateLimitInfo,
          tutor: tutorMetadata
        });
      }

      logFormulaTutorDecisionDebug('student_message_bypassed', formulaTutorDecision);

      const conceptPattern = buildStudentConceptTutorPattern(message);
      const conceptTutorProblem = shouldStartConceptTutorPattern(conceptPattern, result)
        ? startConceptTutor(conceptPattern, message)
        : null;
      if (conceptTutorProblem) {
        hub.currentTutorProblem = conceptTutorProblem;
        hub.pendingClarification = null;
        const response = buildConceptTutorPrompt(hub.currentTutorProblem);
        const tutorMetadata = buildConceptTutorMetadata(hub.currentTutorProblem, {
          latestStudentReply: message
        });
        const entry = appendStudentHubEntry({
          session,
          hub,
          message,
          response,
          routeType: 'concept_tutor',
          confidence: 'strong',
          standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
          isStandardsFollowUp: Boolean(result.isStandardsFollowUp),
          reportableForStandards: false
        });

        logCompletedInteraction({
          message,
          questionRoute: makeConceptTutorRoute(hub.currentTutorProblem, entry),
          answerGiven: response,
          source: 'student',
          sessionId,
          reportableForStandards: false,
          debug: {
            className: session.className || '',
            studentHubId,
            originalRouteType: result.routeType,
            conceptTutor: {
              active: true,
              patternId: hub.currentTutorProblem.id,
              originalQuestion: hub.currentTutorProblem.originalQuestion || ''
            },
            formulaTutorDecision: maybeFormulaTutorDecisionDebug(formulaTutorDecision)
          }
        });

        return res.json({
          response,
          routeType: 'concept_tutor',
          confidence: 'strong',
          rateLimit: rateLimitInfo,
          tutor: tutorMetadata
        });
      }

      const requestedInteraction = detectAnswerRepresentationIntent(message);
      const shouldStartFlashcards = requestedInteraction.requestedLearningShape === 'flashcards' &&
        requestedInteraction.requestedInteractionMode === 'interactive';
      if (shouldStartFlashcards) {
        const deck = buildMotionForceFlashcardDeck(message);
        if (deck) {
          const consumed = consumeStudentQuestionEnergy({
            controls,
            questionRateLimiter,
            classSessionId: sessionId,
            studentHubId
          });
          rateLimitInfo = consumed.rateLimitInfo;

          if (!consumed.allowed) {
            return res.status(429).json({
              error: 'Slow down a little. Try reading the last answer before asking another question.',
              code: 'student_rate_limited',
              retryAfterMs: consumed.retryAfterMs,
              rateLimit: rateLimitInfo
            });
          }

          hub.currentFlashcardSession = startFlashcardSession(deck);
          hub.pendingClarification = null;
          const response = formatFlashcardSessionStart(hub.currentFlashcardSession);
          const entry = appendStudentHubEntry({
            session,
            hub,
            message,
            response,
            routeType: 'flashcard_session',
            confidence: 'strong',
            standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
            isStandardsFollowUp: Boolean(result.isStandardsFollowUp),
            reportableForStandards: false
          });

          logCompletedInteraction({
            message,
            questionRoute: makeFlashcardSessionRoute(hub.currentFlashcardSession, entry),
            answerGiven: response,
            source: 'student',
            sessionId,
            reportableForStandards: false,
            debug: {
              className: session.className || '',
              studentHubId,
              flashcards: flashcardSessionDebug(hub.currentFlashcardSession),
              formulaTutorDecision: maybeFormulaTutorDecisionDebug(formulaTutorDecision)
            }
          });

          return res.json({
            response,
            routeType: 'flashcard_session',
            confidence: 'strong',
            rateLimit: rateLimitInfo,
            flashcards: buildFlashcardSessionMetadata(hub.currentFlashcardSession),
            flashcardSession: buildFlashcardSessionMetadata(hub.currentFlashcardSession),
            tutor: null
          });
        }
      }

      const consumed = consumeStudentQuestionEnergy({
        controls,
        questionRateLimiter,
        classSessionId: sessionId,
        studentHubId
      });
      rateLimitInfo = consumed.rateLimitInfo;

      if (!consumed.allowed) {
        return res.status(429).json({
          error: 'Slow down a little. Try reading the last answer before asking another question.',
          code: 'student_rate_limited',
          retryAfterMs: consumed.retryAfterMs,
          rateLimit: rateLimitInfo
        });
      }

      const entry = {
        message,
        response: result.response,
        routeType: result.routeType,
        confidence: result.confidence,
        standardId: result.standardId || result.questionRoute?.standardId || result.questionRoute?.public?.standardId || '',
        isStandardsFollowUp: Boolean(result.isStandardsFollowUp),
        createdAt: new Date().toISOString()
      };

      session.messages.push(entry);
      hub.pendingClarification = result.pendingClarification || null;
      hub.messages.push(entry);
      hub.messageCount += 1;
      hub.lastMessageAt = entry.createdAt;

      logCompletedInteraction({
        message,
        questionRoute: result.questionRoute,
        answerGiven: result.response,
        source: 'student',
        sessionId,
        debug: {
          className: session.className || '',
          studentHubId,
          formulaTutorDecision: maybeFormulaTutorDecisionDebug(formulaTutorDecision)
        }
      });

      res.json({
        response: result.response,
        routeType: result.routeType,
        confidence: result.confidence,
        rateLimit: rateLimitInfo
      });
    } catch (error) {
      console.error('Student message route error:', error);
      res.status(500).json({
        error: 'Could not answer that student message.'
      });
    }
  });
}

function normalizeStudentControls(value = {}) {
  const controls = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    studentCopyInspectLockEnabled: typeof controls.studentCopyInspectLockEnabled === 'boolean'
      ? controls.studentCopyInspectLockEnabled
      : true,
    studentGuidedFormulaTutoringEnabled: typeof controls.studentGuidedFormulaTutoringEnabled === 'boolean'
      ? controls.studentGuidedFormulaTutoringEnabled
      : true,
    studentQuestionRateLimitEnabled: typeof controls.studentQuestionRateLimitEnabled === 'boolean'
      ? controls.studentQuestionRateLimitEnabled
      : true,
    studentQuestionsPerMinute: normalizeQuestionLimit(controls.studentQuestionsPerMinute)
  };
}

function closeInactiveFormulaTutorProblem(hub) {
  if (!hub || !isClosedFormulaTutorProblem(hub.currentTutorProblem)) return false;
  hub.currentTutorProblem = null;
  return true;
}

function isClosedFormulaTutorProblem(problem) {
  if (!problem || typeof problem !== 'object') return false;
  if (isMotionForceKnowledgeTutorProblem(problem)) return false;

  const formulaLike = Boolean(
    problem.tutorCategory === 'formula' ||
    problem.formulaId ||
    problem.formula ||
    problem.finalAnswer ||
    Array.isArray(problem.steps)
  );
  if (!formulaLike) return false;
  if (problem.completed === true || problem.stopped === true) return true;

  const stepCount = Array.isArray(problem.steps) ? problem.steps.length : 0;
  const currentStepIndex = Number(problem.currentStepIndex);
  return stepCount > 0 && Number.isFinite(currentStepIndex) && currentStepIndex >= stepCount;
}

function logFormulaTutorDecisionDebug(context, decision) {
  if (!isFormulaTutorDebugEnabled()) return;
  console.log('[formula-tutor-debug]', JSON.stringify({
    context,
    ...decision
  }));
}

function maybeFormulaTutorDecisionDebug(decision) {
  return decision || undefined;
}

function isFormulaTutorDebugEnabled() {
  return process.env.FORMULA_TUTOR_DEBUG === '1';
}

function shouldStartConceptTutorPattern(pattern, result) {
  if (!pattern) return false;
  if (pattern.supportedExample === true) return true;

  const routeType = String(result?.routeType || result?.questionRoute?.type || '').trim();
  const publicType = String(result?.questionRoute?.public?.type || '').trim();
  const response = String(result?.response || result?.questionRoute?.directAnswer || '').trim();
  return routeType === 'no_match' ||
    publicType === 'no_match' ||
    /^I need more information about whether the parts are evenly distributed or visible\/separating\./i.test(response);
}

function isLikelyNewQuestionDuringTutor(message) {
  if (isLikelyNewFormulaQuestionDuringTutor(message)) return true;

  const raw = String(message || '').trim();
  const text = raw
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length < 12) return false;
  if (/^(hint|help|stop|cancel|exit|quit|restart|start over|reset)$/.test(text)) return false;
  if (/^(speed|mass|resisting|increasing|decreasing|faster|slower|stopped|friction|inertia)$/.test(text)) return false;

  const asksQuestion = /\?/.test(raw) || /^(what|why|which|how|when|where|does|do|is|are|can)\b/.test(text);
  const hasConceptTerm = /\b(?:reference point|inertia|friction|motion|force|speed|velocity|acceleration|distance|displacement|graph|slope|balanced force|unbalanced force|air resistance|terminal velocity|accuracy|precision|meniscus|measurement|si system|standard units?|scientific method|hypothesis|independent variable|dependent variable|control group|experimental group|qualitative|quantitative|law|theory|endothermic|exothermic|freezing|melting|circuit|series|parallel|matter|conservation of mass|homogeneous|heterogeneous)\b/.test(text);
  const asksForDefinitionOrExplanation =
    /^(?:what\s+is|what\s+are|whats|define|explain|summarize|describe)\b/.test(text) ||
    /^what\s+does\b.*\bmean\b/.test(text) ||
    /^what\s+do\b.*\bmean\b/.test(text);
  if (hasConceptTerm && asksForDefinitionOrExplanation) return true;
  if (/^(?:is|are)\b/.test(text) && /\b(?:endothermic|exothermic|freezing|melting|series|parallel|homogeneous|heterogeneous|kinetic|potential|conduction|convection|radiation)\b/.test(text)) return true;
  if (!asksQuestion) return false;

  if (/^(?:what|which)\s+law\s+is\s+this$/.test(text)) return true;
  if (/\b(?:what|why|which|how)\b/.test(text) && /\b(?:inertia|friction|slope|graph|distance\s+time|distance\s+versus\s+time|flat\s+line|law|paper|crumpled|air\s+resistance|force|motion|velocity|acceleration)\b/.test(text)) {
    return true;
  }

  return false;
}

function buildStudentConceptTutorPattern(message) {
  return buildUnit7AtomicStructureConceptTutorPattern(message) ||
    buildElementCompoundMixtureConceptTutorPattern(message) ||
    buildMixtureConceptTutorPattern(message) ||
    buildPhysicalChemicalChangeConceptTutorPattern(message) ||
    buildBalancedUnbalancedForcesConceptTutorPattern(message) ||
    buildNewtonsLawsConceptTutorPattern(message) ||
    buildReferencePointConceptTutorPattern(message) ||
    buildDistanceDisplacementConceptTutorPattern(message) ||
    buildSpeedVelocityConceptTutorPattern(message) ||
    buildAccelerationConceptTutorPattern(message) ||
    buildTransverseLongitudinalWavesConceptTutorPattern(message) ||
    buildMechanicalElectromagneticWavesConceptTutorPattern(message) ||
    buildEnergyTransferConceptTutorPattern(message) ||
    buildEndothermicExothermicConceptTutorPattern(message) ||
    buildMechanicalEnergyTypesConceptTutorPattern(message) ||
    buildUnit1VariablesConceptTutorPattern(message) ||
    buildUnit1GraphingAxisConceptTutorPattern(message) ||
    buildReflectionRefractionAbsorptionConceptTutorPattern(message) ||
    buildWavePropertiesConceptTutorPattern(message) ||
    buildOpenClosedCircuitsConceptTutorPattern(message) ||
    buildSeriesParallelCircuitsConceptTutorPattern(message) ||
    buildAcidsBasesConceptTutorPattern(message);
}

function isTutorCorrectionDuringTutor(message, currentTutorProblem) {
  if (!currentTutorProblem) return false;

  const text = String(message || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return false;
  if (/\blook\s+at\s+(?:the|this)?\s*problem\b/.test(text)) return true;
  if (/^(?:yes\s+)?(?:it\s+is|that\s+is|thats)\s+(?:right|correct)\b/.test(text)) return true;
  if (/^(?:yes\s+)?it\s+is\s+look\b/.test(text)) return true;
  if (/^no\b/.test(text) && /\b(?:is|equals?|=)\s+(?:the\s+)?(?:distance|time|speed|mass|volume|density|force|acceleration|current|resistance|voltage|power|energy|work|momentum|wavelength|frequency)\b/.test(text)) {
    return true;
  }

  return false;
}

function isTutorStopCommand(message) {
  const text = String(message || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:stop|cancel|exit|quit|nevermind|never mind)$/.test(text);
}

function handleExistingFlashcardSessionMessage(hub, message) {
  const session = hub.currentFlashcardSession || null;
  if (!session || session.type !== 'flashcards') return { handled: false };

  const command = parseFlashcardCommand(message);
  if (session.active) {
    if (!command) {
      hub.currentFlashcardSession = null;
      return { handled: false };
    }

    if (command === 'show') {
      session.showingBack = true;
      return {
        handled: true,
        session,
        response: formatFlashcardBack(session)
      };
    }

    if (command === 'next') {
      const nextIndex = Number(session.currentCardIndex || 0) + 1;
      if (nextIndex >= session.cards.length) {
        session.active = false;
        session.completed = true;
        session.showingBack = false;
        session.reviewedCards = session.cards.length;
        return {
          handled: true,
          session,
          response: formatFlashcardComplete(session)
        };
      }

      session.currentCardIndex = nextIndex;
      session.showingBack = false;
      session.reviewedCards = Math.max(Number(session.reviewedCards || 1), nextIndex + 1);
      return {
        handled: true,
        session,
        response: formatFlashcardFront(session)
      };
    }

    if (command === 'again') {
      session.showingBack = false;
      return {
        handled: true,
        session,
        response: formatFlashcardFront(session)
      };
    }

    if (command === 'stop') {
      session.active = false;
      session.stopped = true;
      hub.currentFlashcardSession = null;
      return {
        handled: true,
        session,
        response: 'Flashcard practice stopped.'
      };
    }
  }

  if (session.completed && command === 'restart') {
    hub.currentFlashcardSession = startFlashcardSession(session);
    return {
      handled: true,
      session: hub.currentFlashcardSession,
      response: formatFlashcardSessionStart(hub.currentFlashcardSession)
    };
  }

  hub.currentFlashcardSession = null;
  return { handled: false };
}

function parseFlashcardCommand(message) {
  const text = String(message || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(?:show|answer|flip)$/.test(text)) return 'show';
  if (/^next$/.test(text)) return 'next';
  if (/^(?:again|repeat)$/.test(text)) return 'again';
  if (/^(?:stop|end|quit)$/.test(text)) return 'stop';
  if (/^restart$/.test(text)) return 'restart';
  return '';
}

function startFlashcardSession(deck = {}) {
  const cards = Array.isArray(deck.cards)
    ? deck.cards.map((card) => ({
      front: String(card.front || '').trim(),
      back: String(card.back || '').trim()
    })).filter((card) => card.front && card.back)
    : [];

  return {
    type: 'flashcards',
    topicId: String(deck.topicId || '').trim(),
    title: titleCaseFlashcardTitle(deck.title || 'Flashcards'),
    cards,
    currentCardIndex: 0,
    showingBack: false,
    active: true,
    completed: false,
    stopped: false,
    reviewedCards: cards.length > 0 ? 1 : 0
  };
}

function formatFlashcardSessionStart(session) {
  return [
    `Flashcards: ${session.title}`,
    '',
    formatFlashcardFront(session)
  ].join('\n');
}

function formatFlashcardFront(session) {
  const card = getCurrentFlashcard(session);
  return [
    `Card ${Number(session.currentCardIndex || 0) + 1} of ${session.cards.length}`,
    `Front: ${card.front}`,
    '',
    'Type show to see the answer, next to skip, or stop to end.'
  ].join('\n');
}

function formatFlashcardBack(session) {
  const card = getCurrentFlashcard(session);
  return [
    `Back: ${card.back}`,
    '',
    'Type next for the next card, again to review this card, or stop to end.'
  ].join('\n');
}

function formatFlashcardComplete(session) {
  return [
    `Flashcard deck complete: ${session.title}`,
    '',
    `You reviewed ${session.reviewedCards || session.cards.length} cards.`,
    'Type restart to review them again, or ask a new question.'
  ].join('\n');
}

function getCurrentFlashcard(session) {
  return session.cards[Number(session.currentCardIndex || 0)] || { front: '', back: '' };
}

function titleCaseFlashcardTitle(value) {
  const text = String(value || '').trim();
  return text || 'Flashcards';
}

function buildFlashcardSessionMetadata(session) {
  if (!session || session.type !== 'flashcards') return null;
  const cards = Array.isArray(session.cards) ? session.cards : [];
  const currentCardIndex = Math.max(0, Number(session.currentCardIndex || 0));
  const card = cards[currentCardIndex] || { front: '', back: '' };
  const active = Boolean(session.active);
  const isComplete = Boolean(session.completed);
  const showingBack = Boolean(session.showingBack);

  return {
    type: 'flashcards',
    topicId: session.topicId || '',
    title: session.title || '',
    currentCardIndex,
    totalCards: cards.length,
    cardCount: cards.length,
    showingBack,
    active,
    completed: isComplete,
    isComplete,
    reviewedCount: Number(session.reviewedCards || 0),
    front: active ? String(card.front || '').trim() : '',
    back: active && showingBack ? String(card.back || '').trim() : null,
    controls: getFlashcardControls(session)
  };
}

function flashcardSessionDebug(session) {
  const metadata = buildFlashcardSessionMetadata(session);
  if (!metadata) return { active: false };
  return metadata;
}

function getFlashcardControls(session) {
  if (!session || session.type !== 'flashcards') return [];
  if (session.completed) return ['restart'];
  if (!session.active) return [];
  return session.showingBack ? ['again', 'next', 'stop'] : ['show', 'next', 'stop'];
}

function answerTutorCelebrationFeedback(message, recentMessages = []) {
  const text = String(message || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[?.!,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/\b(?:fireworks?|celebration|celebrate|confetti)\b/.test(text)) return null;
  if (!/\b(?:no|where|why|missing|didnt|did\s+not|dont|do\s+not)\b/.test(text)) return null;

  const context = findRecentCompletedTutorEntry(recentMessages);
  if (!context) return null;

  return {
    response: 'Thanks for the heads-up. A completed tutor should trigger the celebration once; your answer still counted as complete.',
    context
  };
}

function findRecentCompletedTutorEntry(recentMessages = []) {
  if (!Array.isArray(recentMessages)) return null;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const entry = recentMessages[index] || {};
    const routeType = String(entry.routeType || '');
    if (routeType !== 'formula_tutor' && routeType !== 'motion_force_knowledge_tutor' && routeType !== 'concept_tutor') continue;

    const response = String(entry.response || '').trim();
    if (/^(?:correct|yes)\b/i.test(response)) return entry;
  }

  return null;
}

function createStudentQuestionRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();

  function getBucket(key, limit, currentTime) {
    const existing = buckets.get(key);
    if (!existing) {
      const bucket = { tokens: limit, updatedAt: currentTime, limit };
      buckets.set(key, bucket);
      return bucket;
    }

    refillBucket(existing, limit, currentTime);
    return existing;
  }

  function refillBucket(bucket, limit, currentTime) {
    const previousLimit = normalizeQuestionLimit(bucket.limit);
    const previousUpdatedAt = Number.isFinite(Number(bucket.updatedAt)) ? Number(bucket.updatedAt) : currentTime;
    const elapsedSeconds = Math.max(0, (currentTime - previousUpdatedAt) / 1000);
    const refillRatePerSecond = getRefillRatePerSecond(previousLimit);
    const tokens = Number.isFinite(Number(bucket.tokens)) ? Number(bucket.tokens) : previousLimit;

    bucket.tokens = Math.min(limit, Math.max(0, tokens) + (elapsedSeconds * refillRatePerSecond));
    bucket.updatedAt = currentTime;
    bucket.limit = limit;

    if (bucket.tokens > limit) bucket.tokens = limit;
    return bucket;
  }

  function getRefillRatePerSecond(limit) {
    return normalizeQuestionLimit(limit) / 60;
  }

  function getStatusForBucket(bucket, limit) {
    const remaining = Math.max(0, Math.min(limit, Number(bucket.tokens) || 0));
    const refillRatePerSecond = getRefillRatePerSecond(limit);
    const tokensUntilNext = Math.max(0, 1 - remaining);
    const tokensUntilFull = Math.max(0, limit - remaining);

    return {
      limit,
      max: limit,
      remaining,
      remainingWhole: Math.max(0, Math.min(limit, Math.floor(remaining))),
      refillRatePerSecond,
      secondsUntilNextQuestion: tokensUntilNext > 0 ? Math.ceil(tokensUntilNext / refillRatePerSecond) : 0,
      secondsUntilFull: tokensUntilFull > 0 ? Math.ceil(tokensUntilFull / refillRatePerSecond) : 0
    };
  }

  function setBucket(key, bucket) {
    buckets.set(key, bucket);
    return bucket;
  }

  function getKey(classSessionId, studentHubId) {
    return `${String(classSessionId || '').trim()}::${String(studentHubId || '').trim()}`;
  }

  return {
    check({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, limit, currentTime);

      // TODO: Math guided problem-solving questions may use a different rate limit later.
      if (bucket.tokens < 1) {
        const status = getStatusForBucket(bucket, limit);
        return {
          allowed: false,
          retryAfterMs: Math.max(1000, status.secondsUntilNextQuestion * 1000),
          ...status
        };
      }

      bucket.tokens -= 1;
      setBucket(key, bucket);
      return {
        allowed: true,
        retryAfterMs: 0,
        ...getStatusForBucket(bucket, limit)
      };
    },
    status({ classSessionId, studentHubId, questionsPerMinute }) {
      const limit = normalizeQuestionLimit(questionsPerMinute);
      const key = getKey(classSessionId, studentHubId);
      const currentTime = now();
      const bucket = getBucket(key, limit, currentTime);
      return getStatusForBucket(bucket, limit);
    },
    reset() {
      buckets.clear();
    }
  };
}

function normalizeQuestionLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return 6;
  return Math.min(number, 30);
}

function getStudentRateLimitInfo({ controls, questionRateLimiter, classSessionId, studentHubId }) {
  if (!controls.studentQuestionRateLimitEnabled) {
    return toPublicRateLimit({
      enabled: false,
      limit: controls.studentQuestionsPerMinute,
      max: controls.studentQuestionsPerMinute,
      remaining: controls.studentQuestionsPerMinute,
      remainingWhole: controls.studentQuestionsPerMinute,
      refillRatePerSecond: controls.studentQuestionsPerMinute / 60,
      secondsUntilNextQuestion: 0,
      secondsUntilFull: 0
    });
  }

  const status = questionRateLimiter.status({
    classSessionId,
    studentHubId,
    questionsPerMinute: controls.studentQuestionsPerMinute
  });

  return toPublicRateLimit({
    enabled: true,
    limit: status.limit,
    remaining: status.remaining,
    remainingWhole: status.remainingWhole,
    max: status.max,
    refillRatePerSecond: status.refillRatePerSecond,
    secondsUntilNextQuestion: status.secondsUntilNextQuestion,
    secondsUntilFull: status.secondsUntilFull
  });
}

function consumeStudentQuestionEnergy({ controls, questionRateLimiter, classSessionId, studentHubId }) {
  if (!controls.studentQuestionRateLimitEnabled) {
    return {
      allowed: true,
      retryAfterMs: 0,
      rateLimitInfo: getStudentRateLimitInfo({
        controls,
        questionRateLimiter,
        classSessionId,
        studentHubId
      })
    };
  }

  const rateLimit = questionRateLimiter.check({
    classSessionId,
    studentHubId,
    questionsPerMinute: controls.studentQuestionsPerMinute
  });

  return {
    allowed: rateLimit.allowed,
    retryAfterMs: rateLimit.retryAfterMs,
    rateLimitInfo: toPublicRateLimit({
      enabled: true,
      limit: controls.studentQuestionsPerMinute,
      remaining: rateLimit.remaining,
      remainingWhole: rateLimit.remainingWhole,
      max: rateLimit.max,
      refillRatePerSecond: rateLimit.refillRatePerSecond,
      secondsUntilNextQuestion: rateLimit.secondsUntilNextQuestion,
      secondsUntilFull: rateLimit.secondsUntilFull
    })
  };
}

function toPublicRateLimit({
  enabled,
  limit,
  remaining,
  remainingWhole,
  max,
  refillRatePerSecond,
  secondsUntilNextQuestion,
  secondsUntilFull
}) {
  const normalizedLimit = normalizeQuestionLimit(limit);
  const normalizedMax = normalizeQuestionLimit(max || normalizedLimit);
  const normalizedRemaining = Math.max(0, Math.min(normalizedMax, Number.isFinite(Number(remaining)) ? Number(remaining) : 0));
  const normalizedRefillRate = Number.isFinite(Number(refillRatePerSecond)) && Number(refillRatePerSecond) > 0
    ? Number(refillRatePerSecond)
    : normalizedLimit / 60;
  const nextSeconds = Number.isFinite(Number(secondsUntilNextQuestion))
    ? Math.max(0, Math.ceil(Number(secondsUntilNextQuestion)))
    : (normalizedRemaining >= 1 ? 0 : Math.ceil((1 - normalizedRemaining) / normalizedRefillRate));
  const fullSeconds = Number.isFinite(Number(secondsUntilFull))
    ? Math.max(0, Math.ceil(Number(secondsUntilFull)))
    : Math.ceil(Math.max(0, normalizedMax - normalizedRemaining) / normalizedRefillRate);

  return {
    enabled: Boolean(enabled),
    limit: normalizedLimit,
    remaining: Number(normalizedRemaining.toFixed(4)),
    remainingWhole: Number.isInteger(Number(remainingWhole))
      ? Math.max(0, Math.min(normalizedMax, Number(remainingWhole)))
      : Math.max(0, Math.min(normalizedMax, Math.floor(normalizedRemaining))),
    max: normalizedMax,
    refillRatePerSecond: Number(normalizedRefillRate.toFixed(4)),
    secondsUntilNextQuestion: nextSeconds,
    secondsUntilFull: fullSeconds,
    windowSeconds: 60,
    resetInSeconds: nextSeconds
  };
}

function touchAnonymousHub(session, studentHubId) {
  session.anonymousHubs = session.anonymousHubs || Object.create(null);
  const now = new Date().toISOString();
  const existingHubCount = Object.keys(session.anonymousHubs).length;
  const hub = session.anonymousHubs[studentHubId] || {
    studentHubId,
    label: `Anonymous Student ${existingHubCount + 1}`,
    firstSeenAt: now,
    lastSeenAt: now,
    lastMessageAt: '',
    messageCount: 0,
    messages: [],
    pendingClarification: null,
    currentTutorProblem: null,
    currentFlashcardSession: null
  };

  hub.lastSeenAt = now;
  if (!Array.isArray(hub.messages)) hub.messages = [];
  if (!Object.prototype.hasOwnProperty.call(hub, 'currentTutorProblem')) hub.currentTutorProblem = null;
  if (!Object.prototype.hasOwnProperty.call(hub, 'currentFlashcardSession')) hub.currentFlashcardSession = null;
  session.anonymousHubs[studentHubId] = hub;
  return hub;
}

function appendStudentHubEntry({
  session,
  hub,
  message,
  response,
  routeType,
  confidence,
  standardId = '',
  isStandardsFollowUp = false,
  contextPrompt = '',
  isTutorStep = false,
  reportableForStandards = true,
  tutorOriginalQuestion = ''
}) {
  const entry = {
    message,
    response,
    routeType,
    confidence,
    standardId,
    isStandardsFollowUp,
    contextPrompt,
    isTutorStep,
    reportableForStandards,
    tutorOriginalQuestion,
    createdAt: new Date().toISOString()
  };

  session.messages.push(entry);
  hub.pendingClarification = null;
  hub.messages.push(entry);
  hub.messageCount += 1;
  hub.lastMessageAt = entry.createdAt;
  return entry;
}

function makeFormulaTutorRoute(currentTutorProblem) {
  const problem = currentTutorProblem || {};
  const isComplete = Array.isArray(problem.steps) &&
    problem.steps.length > 0 &&
    Number(problem.currentStepIndex) >= problem.steps.length;
  const finalAnswer = isComplete ? (problem.finalAnswer || null) : null;
  const finalExplanation = isComplete ? (problem.finalExplanation || '') : '';
  const route = {
    type: 'formula_tutor',
    confidence: 'strong',
    toolsUsed: ['formula_tutor'],
    notes: 'Guided formula tutor step.',
    aiAllowed: false,
    tutorCategory: 'formula',
    tutorLabel: 'Formula Tutor',
    originalQuestion: problem.originalQuestion || '',
    finalAnswer,
    finalExplanation,
    formulaWork: {
      formulaId: problem.formulaId || '',
      family: problem.family || '',
      solveFor: problem.solveFor || '',
      formula: problem.formula || '',
      steps: Array.isArray(problem.steps) ? problem.steps : []
    },
    public: {
      type: 'formula_tutor',
      confidence: 'strong',
      toolsUsed: ['formula_tutor'],
      notes: 'Guided formula tutor step.',
      aiAllowed: false,
      tutorCategory: 'formula',
      tutorLabel: 'Formula Tutor',
      originalQuestion: problem.originalQuestion || '',
      finalAnswer,
      finalExplanation,
      formulaWork: {
        formulaId: problem.formulaId || '',
        family: problem.family || '',
        solveFor: problem.solveFor || '',
        formula: problem.formula || '',
        hasGuidedSteps: Array.isArray(problem.steps) && problem.steps.length > 0
      }
    }
  };

  if (isGraphTutorSupport(problem.graphTutorSupport)) {
    route.graphTutorSupport = clonePlain(problem.graphTutorSupport);
    route.public.graphTutorSupport = clonePlain(problem.graphTutorSupport);
  }

  return route;
}

function isGraphTutorSupport(value) {
  return value &&
    value.aiAllowed === false &&
    value.source === 'approved_knowledge_graph' &&
    Array.isArray(value.connectedConcepts) &&
    Array.isArray(value.prerequisiteConcepts) &&
    Array.isArray(value.commonMisconceptions) &&
    Array.isArray(value.whyItMatters) &&
    Array.isArray(value.graphPaths);
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeMotionForceKnowledgeTutorRoute(currentTutorProblem) {
  const problem = currentTutorProblem || {};
  return {
    type: 'motion_force_knowledge_tutor',
    confidence: 'strong',
    toolsUsed: ['motion_force_knowledge_tutor'],
    notes: 'Guided general tutor step.',
    aiAllowed: false,
    tutorCategory: 'general',
    tutorLabel: 'General Tutor',
    originalQuestion: problem.originalQuestion || '',
    topic: problem.topic || '',
    title: problem.topic || '',
    finalAnswer: problem.finalAnswer || '',
    finalExplanation: problem.finalAnswer || '',
    motionForceTutor: {
      id: problem.id || '',
      topic: problem.topic || '',
      category: problem.category || '',
      guidingQuestions: Array.isArray(problem.guidingQuestions) ? problem.guidingQuestions : []
    },
    public: {
      type: 'motion_force_knowledge_tutor',
      confidence: 'strong',
      toolsUsed: ['motion_force_knowledge_tutor'],
      notes: 'Guided general tutor step.',
      aiAllowed: false,
      tutorCategory: 'general',
      tutorLabel: 'General Tutor',
      originalQuestion: problem.originalQuestion || '',
      topic: problem.topic || '',
      title: problem.topic || '',
      finalAnswer: problem.finalAnswer || '',
      finalExplanation: problem.finalAnswer || '',
      motionForceTutor: {
        id: problem.id || '',
        topic: problem.topic || '',
        category: problem.category || '',
        hasGuidedSteps: Array.isArray(problem.guidingQuestions) && problem.guidingQuestions.length > 0
      }
    }
  };
}

function makeConceptTutorRoute(currentTutorProblem) {
  const problem = currentTutorProblem || {};
  const isComplete = Array.isArray(problem.steps) &&
    problem.steps.length > 0 &&
    Number(problem.currentStepIndex) >= problem.steps.length;
  const finalAnswer = isComplete ? (problem.finalAnswer || '') : '';
  const toolsUsed = getConceptTutorToolsUsed(problem);

  return {
    type: 'concept_tutor',
    confidence: 'strong',
    toolsUsed,
    notes: 'Guided concept tutor step.',
    aiAllowed: false,
    tutorCategory: 'concept',
    tutorLabel: 'Concept Tutor',
    originalQuestion: problem.originalQuestion || '',
    topic: problem.topic || '',
    title: problem.topic || '',
    finalAnswer,
    finalExplanation: finalAnswer,
    conceptTutor: {
      id: problem.id || '',
      topic: problem.topic || '',
      steps: Array.isArray(problem.steps) ? problem.steps : []
    },
    public: {
      type: 'concept_tutor',
      confidence: 'strong',
      toolsUsed,
      notes: 'Guided concept tutor step.',
      aiAllowed: false,
      tutorCategory: 'concept',
      tutorLabel: 'Concept Tutor',
      originalQuestion: problem.originalQuestion || '',
      topic: problem.topic || '',
      title: problem.topic || '',
      finalAnswer,
      finalExplanation: finalAnswer,
      conceptTutor: {
        id: problem.id || '',
        topic: problem.topic || '',
        hasGuidedSteps: Array.isArray(problem.steps) && problem.steps.length > 0
      }
    }
  };
}

function getConceptTutorToolsUsed(problem) {
  const id = String(problem?.id || '');
  if (id === 'matter.element-compound-mixture') {
    return ['concept_tutor', 'element_compound_mixture_concept_pattern'];
  }
  if (id === 'matter.mixtures.homogeneous-heterogeneous') {
    return ['concept_tutor', 'mixture_concept_pattern'];
  }
  if (id === 'motion-force.newtons-laws.identification') {
    return ['concept_tutor', 'newtons_laws_identification_concept_pattern'];
  }
  if (id === 'motion-force.balanced-unbalanced-forces.identification') {
    return ['concept_tutor', 'balanced_unbalanced_forces_concept_pattern'];
  }
  if (id === 'motion-force.distance-displacement.identification') {
    return ['concept_tutor', 'distance_displacement_concept_pattern'];
  }
  if (id === 'motion-force.acceleration.identification') {
    return ['concept_tutor', 'acceleration_concept_pattern'];
  }
  if (id === 'waves.transverse-longitudinal.identification') {
    return ['concept_tutor', 'transverse_longitudinal_waves_concept_pattern'];
  }
  if (id === 'waves.mechanical-electromagnetic.identification') {
    return ['concept_tutor', 'mechanical_electromagnetic_waves_concept_pattern'];
  }
  if (id === 'energy.transfer.conduction-convection-radiation') {
    return ['concept_tutor', 'energy_transfer_concept_pattern'];
  }
  if (id === 'energy.processes.endothermic-exothermic.identification') {
    return ['concept_tutor', 'endothermic_exothermic_concept_pattern'];
  }
  if (id === 'energy.mechanical-types.kinetic-gpe-elastic.identification') {
    return ['concept_tutor', 'mechanical_energy_types_concept_pattern'];
  }
  if (id === 'waves.reflection-refraction-absorption.identification') {
    return ['concept_tutor', 'reflection_refraction_absorption_concept_pattern'];
  }
  if (id === 'waves.properties.amplitude-wavelength-frequency') {
    return ['concept_tutor', 'wave_properties_concept_pattern'];
  }
  if (id === 'electricity.circuits.open-closed.identification') {
    return ['concept_tutor', 'open_closed_circuits_concept_pattern'];
  }
  if (id === 'electricity.circuits.series-parallel.identification') {
    return ['concept_tutor', 'series_parallel_circuits_concept_pattern'];
  }
  if (id === 'chemistry.acids-bases.identification') {
    return ['concept_tutor', 'acids_bases_concept_pattern'];
  }
  if (id === 'matter.physical-chemical-change.identification') {
    return ['concept_tutor', 'physical_chemical_change_concept_pattern'];
  }
  return ['concept_tutor'];
}

function makeFlashcardSessionRoute(session) {
  const metadata = buildFlashcardSessionMetadata(session) || {};
  return {
    type: 'flashcard_session',
    confidence: 'strong',
    toolsUsed: ['motion_force_knowledge', 'learning_shape_flashcards'],
    notes: 'Handled interactive text flashcard session.',
    directAnswer: '',
    aiAllowed: false,
    flashcards: metadata,
    public: {
      type: 'flashcard_session',
      confidence: 'strong',
      toolsUsed: ['motion_force_knowledge', 'learning_shape_flashcards'],
      notes: 'Handled interactive text flashcard session.',
      aiAllowed: false,
      flashcards: metadata
    }
  };
}

function makeTutorControlRoute() {
  return {
    type: 'tutor_control',
    confidence: 'strong',
    toolsUsed: ['tutor_control'],
    notes: 'Handled tutor control command without an active tutor.',
    directAnswer: 'There is no active tutor to stop. You can ask a new question whenever you’re ready.',
    aiAllowed: false,
    public: {
      type: 'tutor_control',
      confidence: 'strong',
      toolsUsed: ['tutor_control'],
      notes: 'Handled tutor control command without an active tutor.',
      aiAllowed: false
    }
  };
}

function makeAppFeedbackRoute(response) {
  return {
    type: 'app_feedback',
    confidence: 'strong',
    toolsUsed: ['app_feedback'],
    notes: 'Handled student app feedback after a completed tutor.',
    directAnswer: response,
    aiAllowed: false,
    public: {
      type: 'app_feedback',
      confidence: 'strong',
      toolsUsed: ['app_feedback'],
      notes: 'Handled student app feedback after a completed tutor.',
      aiAllowed: false
    }
  };
}

function findLastAnsweredContext(messages) {
  if (!Array.isArray(messages)) return { prompt: '', answer: '' };

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (!entry?.message || entry.isStandardsFollowUp) continue;
    if (entry.routeType === 'no_match') continue;
    if (entry.routeType === 'tutor_control') continue;
    if (entry.routeType === 'app_feedback') continue;
    if (isInstructionalFollowUpPrompt(entry.message) && !isResolvedNumberChoice(entry)) continue;
    if (!entry.response) continue;
    return {
      prompt: entry.contextPrompt || entry.message,
      answer: entry.response
    };
  }

  return { prompt: '', answer: '' };
}

function findLastStandardIdForCurrentContext(messages) {
  if (!Array.isArray(messages)) return '';

  let contextIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (!entry?.message || entry.isStandardsFollowUp) continue;
    if (entry.routeType === 'no_match') continue;
    if (entry.routeType === 'tutor_control') continue;
    if (entry.routeType === 'app_feedback') continue;
    if (isInstructionalFollowUpPrompt(entry.message) && !isResolvedNumberChoice(entry)) continue;
    if (!entry.response) continue;
    contextIndex = index;
    break;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (contextIndex >= 0 && index <= contextIndex) break;
    const standardId = String(messages[index]?.standardId || '').trim();
    if (standardId) return standardId;
  }

  return '';
}

function isResolvedNumberChoice(entry) {
  return /^\s*\d+\s*$/.test(String(entry?.message || '')) &&
    entry.routeType &&
    !['no_match', 'standards_followup', 'clarification_followup'].includes(entry.routeType);
}

module.exports = {
  findLastAnsweredContext,
  findLastStandardIdForCurrentContext,
  createStudentQuestionRateLimiter,
  getStudentRateLimitInfo,
  normalizeStudentControls,
  toPublicRateLimit,
  registerStudentRoutes,
  touchAnonymousHub
};
