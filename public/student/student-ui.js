(() => {
  const STUDENT_HUB_STORAGE_KEY = 'charlemagne.anonymousStudentHubId';
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId') || params.get('classSessionId') || '';
  const studentHubId = getOrCreateStudentHubId();
  const form = document.getElementById('studentMessageForm');
  const input = document.getElementById('studentMessageInput');
  const composerTutorChoices = document.getElementById('studentComposerTutorChoices');
  const sendButton = document.getElementById('studentSendButton');
  const pointButton = document.getElementById('studentPointButton');
  const askHighlightButton = document.getElementById('studentAskHighlightButton');
  const clearButton = document.getElementById('studentClearButton');
  const timeline = document.getElementById('studentTimeline');
  const sessionText = document.getElementById('sessionIdText');
  const status = document.getElementById('studentStatus');
  const routeInfo = document.getElementById('studentRouteInfo');
  const fireworks = document.getElementById('studentTutorFireworks');
  const sessionMessage = document.getElementById('studentSessionMessage');
  const frictionWarning = document.getElementById('studentFrictionWarning');
  const energyPanel = document.getElementById('studentQuestionEnergy');
  const energyValue = document.getElementById('studentQuestionEnergyValue');
  const energyHelper = document.getElementById('studentQuestionEnergyHelper');
  const energyFill = document.getElementById('studentQuestionEnergyFill');
  const chatTurns = [];
  const FIREWORKS_MAX_PARTICLES = 170;
  const FIREWORKS_DURATION_MS = 3600;
  const FIREWORK_COLORS = [
    '#fff76a',
    '#ff4fd8',
    '#36d6ff',
    '#68ff8f',
    '#ff7a2f',
    '#b56cff',
    '#ffffff',
    '#66f7d1',
    '#ff3f6e'
  ];
  const controls = {
    studentCopyInspectLockEnabled: true,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 6
  };
  const rateLimitState = {
    enabled: false,
    limit: 6,
    max: 6,
    remaining: 6,
    remainingWhole: 6,
    refillRatePerSecond: 0.1,
    secondsUntilNextQuestion: 0,
    secondsUntilFull: 0,
    windowSeconds: 60,
    resetInSeconds: 0,
    updatedAtMs: Date.now()
  };
  let sessionIsValid = false;
  let heartbeatTimer = null;
  let rateLimitStatusTimer = null;
  let resetTickTimer = null;
  let warningTimer = null;
  let devtoolsTimer = null;
  let calculatorExpression = '';
  let calculatorJustEvaluated = false;
  let activeCalculatorStepKey = '';
  const calculatorOpenTurnIds = new Set();
  const metricStairStepState = new Map();
  const metricStairStepPreviewState = new Map();
  const metricStairStepCompletionState = new Set();
  const picketFenceState = new Map();
  const scientificNotationState = new Map();
  const tutorSessionExpandedState = new Map();
  const tutorStepExpandedState = new Map();
  let completedCelebrationKey = '';
  let fireworksTimer = null;
  let turnCounter = 0;
  let lastAnswerText = '';
  const defaultInputPlaceholder = input?.getAttribute('placeholder') || 'Ask a science question...';

  async function init() {
    if (!form || !input || !sendButton || !timeline) return;

    sessionText.textContent = sessionId || 'Missing session';
    setFormEnabled(false);
    renderTimeline();
    await loadStudentControls();
    renderRateLimitEnergy();
    await validateSession();

    form.addEventListener('submit', handleSubmit);
    input.addEventListener('keydown', handleInputKeydown);
    pointButton?.addEventListener('click', handlePointClick);
    askHighlightButton?.addEventListener('click', handleAskHighlightClick);
    clearButton?.addEventListener('click', handleClearClick);
    composerTutorChoices?.addEventListener('click', handleComposerTutorChoiceClick);
    timeline.addEventListener('click', handleTimelineClick);
    timeline.addEventListener('mouseover', handleTimelinePreview);
    timeline.addEventListener('focusin', handleTimelinePreview);
    timeline.addEventListener('mouseout', handleTimelinePreviewClear);
    timeline.addEventListener('focusout', handleTimelinePreviewClear);
    installClassroomFrictionHandlers();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || !sessionIsValid) return;

    const turnId = addPendingTurn(message);
    setSendingState();

    try {
      const data = await sendStudentMessage(message);
      renderStudentMessageResult(data, message, { turnId });
      input.value = '';
    } catch (error) {
      renderStudentError(turnId, error);
      if (/session/i.test(error.message || '')) {
        showInvalidSession(error.message);
      }
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  function handleInputKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    if (!input.value.trim() || sendButton.disabled) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit(sendButton);
    } else {
      sendButton.click();
    }
  }

  async function handlePointClick() {
    if (!sessionIsValid) return;

    flashPointButton();
    playPointClick();
    const prompt = "What's the point?";
    const turnId = addPendingTurn(prompt);
    setSendingState();

    try {
      const data = await window.Charlemagne.api.sendStudentWhyThisMatters(sessionId, studentHubId);
      renderStudentMessageResult(data, prompt, { turnId });
    } catch (error) {
      renderStudentError(turnId, error);
      if (/session/i.test(error.message || '')) {
        showInvalidSession(error.message);
      }
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  async function validateSession() {
    if (!sessionId) {
      showInvalidSession('This student link is missing a session id. Ask your teacher for a new link.');
      return;
    }

    try {
      await window.Charlemagne.api.joinStudentSession(sessionId, studentHubId);
      await refreshRateLimitStatus();

      sessionIsValid = true;
      sessionText.textContent = sessionId;
      sessionMessage.textContent = 'Connected to session.';
      status.textContent = 'Connected';
      setFormEnabled(true);
      startHeartbeat();
      startRateLimitRefresh();
      input.focus();
    } catch (error) {
      showInvalidSession(error.message || 'Could not check this student session.');
    }
  }

  async function loadStudentControls() {
    try {
      const data = await window.Charlemagne.api.fetchStudentControls();
      controls.studentCopyInspectLockEnabled = data.studentCopyInspectLockEnabled !== false;
      controls.studentQuestionRateLimitEnabled = data.studentQuestionRateLimitEnabled !== false;
      controls.studentQuestionsPerMinute = Number(data.studentQuestionsPerMinute) || 6;
      rateLimitState.enabled = controls.studentQuestionRateLimitEnabled;
      rateLimitState.limit = controls.studentQuestionsPerMinute;
      rateLimitState.max = controls.studentQuestionsPerMinute;
      rateLimitState.remaining = controls.studentQuestionsPerMinute;
      rateLimitState.remainingWhole = controls.studentQuestionsPerMinute;
      rateLimitState.refillRatePerSecond = controls.studentQuestionsPerMinute / 60;
      rateLimitState.secondsUntilNextQuestion = 0;
      rateLimitState.secondsUntilFull = 0;
      rateLimitState.updatedAtMs = Date.now();
    } catch {
      controls.studentCopyInspectLockEnabled = true;
      controls.studentQuestionRateLimitEnabled = true;
      controls.studentQuestionsPerMinute = 6;
      rateLimitState.enabled = true;
      rateLimitState.limit = 6;
      rateLimitState.max = 6;
      rateLimitState.remaining = 6;
      rateLimitState.remainingWhole = 6;
      rateLimitState.refillRatePerSecond = 0.1;
      rateLimitState.secondsUntilNextQuestion = 0;
      rateLimitState.secondsUntilFull = 0;
      rateLimitState.updatedAtMs = Date.now();
    }
  }

  async function sendHeartbeat() {
    if (!sessionId || !studentHubId) return;
    await window.Charlemagne.api.joinStudentSession(sessionId, studentHubId);
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = window.setInterval(() => {
      sendHeartbeat().catch(() => {});
    }, 30_000);
  }

  async function refreshRateLimitStatus() {
    if (!sessionId || !studentHubId) return;
    try {
      const data = await window.Charlemagne.api.fetchStudentRateLimitStatus(sessionId, studentHubId);
      updateRateLimitState(data.rateLimit);
    } catch {
      renderRateLimitEnergy();
    }
  }

  function startRateLimitRefresh() {
    if (!resetTickTimer) {
      resetTickTimer = window.setInterval(() => {
        advanceLocalRateLimit();
        renderRateLimitEnergy();
      }, 1000);
    }

    if (rateLimitStatusTimer) return;
    rateLimitStatusTimer = window.setInterval(() => {
      refreshRateLimitStatus().catch(() => {});
    }, 12_000);
  }

  function updateRateLimitState(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return;

    rateLimitState.enabled = rateLimit.enabled === true;
    rateLimitState.limit = normalizePositiveInteger(rateLimit.limit, controls.studentQuestionsPerMinute);
    rateLimitState.max = normalizePositiveInteger(rateLimit.max, rateLimitState.limit);
    rateLimitState.remaining = Math.max(0, Math.min(rateLimitState.max, normalizeNonNegativeNumber(rateLimit.remaining, rateLimitState.max)));
    rateLimitState.remainingWhole = Math.max(0, Math.min(rateLimitState.max, normalizeNonNegativeInteger(rateLimit.remainingWhole, Math.floor(rateLimitState.remaining))));
    rateLimitState.refillRatePerSecond = normalizePositiveNumber(rateLimit.refillRatePerSecond, rateLimitState.limit / 60);
    rateLimitState.secondsUntilNextQuestion = normalizeNonNegativeInteger(rateLimit.secondsUntilNextQuestion, 0);
    rateLimitState.secondsUntilFull = normalizeNonNegativeInteger(rateLimit.secondsUntilFull, 0);
    rateLimitState.windowSeconds = normalizePositiveInteger(rateLimit.windowSeconds, 60);
    rateLimitState.resetInSeconds = normalizeNonNegativeInteger(rateLimit.resetInSeconds, 0);
    rateLimitState.updatedAtMs = Date.now();
    controls.studentQuestionRateLimitEnabled = rateLimitState.enabled;
    controls.studentQuestionsPerMinute = rateLimitState.limit;
    renderRateLimitEnergy();
  }

  function advanceLocalRateLimit() {
    if (!rateLimitState.enabled) return;

    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, (nowMs - rateLimitState.updatedAtMs) / 1000);
    const max = normalizePositiveInteger(rateLimitState.max, rateLimitState.limit);
    const refillRate = normalizePositiveNumber(rateLimitState.refillRatePerSecond, rateLimitState.limit / 60);

    rateLimitState.remaining = Math.min(max, Math.max(0, rateLimitState.remaining) + (elapsedSeconds * refillRate));
    rateLimitState.remainingWhole = Math.max(0, Math.min(max, Math.floor(rateLimitState.remaining)));
    rateLimitState.secondsUntilNextQuestion = rateLimitState.remaining >= 1
      ? 0
      : Math.ceil((1 - rateLimitState.remaining) / refillRate);
    rateLimitState.secondsUntilFull = Math.ceil(Math.max(0, max - rateLimitState.remaining) / refillRate);
    rateLimitState.resetInSeconds = rateLimitState.secondsUntilNextQuestion;
    rateLimitState.updatedAtMs = nowMs;
  }

  function renderRateLimitEnergy() {
    if (!energyPanel || !energyValue || !energyFill) return;

    const limit = normalizePositiveInteger(rateLimitState.limit, controls.studentQuestionsPerMinute);
    const max = normalizePositiveInteger(rateLimitState.max, limit);
    const remaining = Math.max(0, Math.min(max, Number(rateLimitState.remaining) || 0));
    const remainingWhole = Math.max(0, Math.min(max, Math.floor(remaining)));
    const percent = rateLimitState.enabled ? Math.max(0, Math.min(100, (remaining / max) * 100)) : 100;

    energyPanel.hidden = false;
    energyPanel.classList.toggle('is-off', !rateLimitState.enabled);
    energyPanel.classList.toggle('is-low', rateLimitState.enabled && remaining > 0 && remaining <= Math.max(1, Math.ceil(max * 0.25)));
    energyPanel.classList.toggle('is-empty', rateLimitState.enabled && remainingWhole <= 0);
    energyFill.style.width = `${percent}%`;

    if (!rateLimitState.enabled) {
      energyValue.textContent = 'Limit off';
      if (energyHelper) energyHelper.textContent = '';
      energyFill.style.width = '100%';
      return;
    }

    energyValue.textContent = `${remainingWhole}/${max} ready`;
    if (energyHelper) {
      const nextQuestionSeconds = normalizeNonNegativeInteger(rateLimitState.secondsUntilNextQuestion, 0);
      const fullSeconds = normalizeNonNegativeInteger(rateLimitState.secondsUntilFull, 0);
      energyHelper.textContent = fullSeconds > 0 && remainingWhole <= 0
        ? `Next question in ${nextQuestionSeconds}s`
        : fullSeconds > 0 && remainingWhole <= Math.max(1, Math.floor(max * 0.25))
          ? `Full in ${fullSeconds}s`
          : '';
    }
  }

  function showInvalidSession(message) {
    sessionIsValid = false;
    sessionMessage.textContent = message;
    status.textContent = 'Invalid session';
    routeInfo.textContent = 'Unavailable';
    addSystemMessage(message);
    setFormEnabled(false);
  }

  function setSendingState() {
    setFormEnabled(false);
    status.textContent = 'Sending';
    routeInfo.textContent = 'Routing';
  }

  function setFormEnabled(enabled) {
    input.disabled = !enabled;
    sendButton.disabled = !enabled;
    if (pointButton) pointButton.disabled = !enabled;
    if (askHighlightButton) askHighlightButton.disabled = !enabled;
    if (clearButton) clearButton.disabled = !enabled;
    if (timeline) {
      for (const button of timeline.querySelectorAll('button')) {
        button.disabled = !enabled;
      }
    }
    if (composerTutorChoices) {
      for (const button of composerTutorChoices.querySelectorAll('button')) {
        button.disabled = !enabled;
      }
    }
  }

  async function sendStudentMessage(message) {
    return window.Charlemagne.api.sendStudentMessage(sessionId, message, studentHubId);
  }

  function addPendingTurn(message) {
    collapseTutorCardsForNewTurn();
    const turn = {
      id: createTurnId(),
      message,
      response: 'Thinking...',
      routeType: '',
      confidence: '',
      tutor: null,
      flashcardSession: null,
      tutorCollapsed: false,
      pending: true,
      error: false,
      createdAt: new Date().toISOString()
    };
    chatTurns.push(turn);
    renderTimeline();
    scrollTimelineToBottom();
    return turn.id;
  }

  function renderStudentMessageResult(data, message, options = {}) {
    updateRateLimitState(data.rateLimit);

    const turn = findTurn(options.turnId) || createCompletedTurn(message);
    turn.response = data.response || 'No response returned.';
    turn.routeType = data.routeType || '';
    turn.confidence = data.confidence || '';
    turn.tutor = data.tutor && typeof data.tutor === 'object' ? clonePlain(data.tutor) : null;
    turn.flashcardSession = data.flashcardSession && typeof data.flashcardSession === 'object'
      ? clonePlain(data.flashcardSession)
      : data.flashcards && typeof data.flashcards === 'object'
        ? clonePlain(data.flashcards)
        : null;
    turn.tutorSubmittedMessage = message;
    turn.tutorCollapsed = false;
    turn.pending = false;
    turn.error = false;
    resetCalculatorForTutorStepChange(turn.tutor);
    if (turn.tutor) {
      collapsePriorTutorCards(turn.id);
    }
    lastAnswerText = turn.response;
    routeInfo.textContent = formatRouteStatusLabel(data.routeType, data.confidence);
    status.textContent = 'Ready';

    renderTimeline();
    maybeCelebrateTutorCompletion(turn.tutor, getTutorWork(turn.tutor), { submittedMessage: message });
    scrollTimelineToBottom();
  }

  function renderStudentError(turnId, error) {
    const turn = findTurn(turnId);
    const message = error?.message || 'Could not send message.';
    updateRateLimitState(error?.rateLimit);
    if (turn) {
      turn.response = friendlyStudentError(message);
      turn.pending = false;
      turn.error = true;
      turn.routeType = 'error';
      turn.confidence = '';
      lastAnswerText = turn.response;
    } else {
      addSystemMessage(friendlyStudentError(message));
    }
    routeInfo.textContent = 'Error';
    status.textContent = 'Error';
    renderTimeline();
    scrollTimelineToBottom();
  }

  function createCompletedTurn(message) {
    const turn = {
      id: createTurnId(),
      message,
      response: '',
      routeType: '',
      confidence: '',
      tutor: null,
      flashcardSession: null,
      tutorCollapsed: false,
      pending: false,
      error: false,
      createdAt: new Date().toISOString()
    };
    chatTurns.push(turn);
    return turn;
  }

  function addSystemMessage(message) {
    const duplicate = chatTurns.some((turn) => turn.system && turn.response === message);
    if (duplicate) return;
    chatTurns.push({
      id: createTurnId(),
      system: true,
      response: message,
      pending: false,
      error: false,
      createdAt: new Date().toISOString()
    });
    renderTimeline();
  }

  function createTurnId() {
    turnCounter += 1;
    return `turn-${turnCounter}`;
  }

  function findTurn(turnId) {
    return chatTurns.find((turn) => turn.id === turnId) || null;
  }

  function getCurrentActiveTutorTurn() {
    const latestTurn = chatTurns[chatTurns.length - 1] || null;
    const tutor = latestTurn?.tutor;
    if (!tutor || latestTurn.system || latestTurn.pending || latestTurn.error) return null;
    if (tutor.active !== true || tutor.completed || tutor.stopped) return null;
    return latestTurn;
  }

  function isCurrentActiveTutorTurn(turn) {
    return Boolean(turn?.id && getCurrentActiveTutorTurn()?.id === turn.id);
  }

  function isLiveTutorControl(control) {
    const turnElement = control?.closest?.('[data-tutor-turn-id]');
    const turnId = turnElement?.getAttribute('data-tutor-turn-id') || '';
    return Boolean(turnId && getCurrentActiveTutorTurn()?.id === turnId);
  }

  function collapseTutorCardsForNewTurn() {
    for (const turn of chatTurns) {
      if (turn.tutor && !getTutorSessionKey(turn)) turn.tutorCollapsed = true;
    }
  }

  function collapsePriorTutorCards(currentTurnId) {
    const currentTurn = findTurn(currentTurnId);
    const currentSessionKey = getTutorSessionKey(currentTurn);
    if (currentSessionKey) {
      const previousSessionKey = findLatestTutorSessionKeyBeforeTurn(currentTurnId);
      if (previousSessionKey && previousSessionKey !== currentSessionKey) {
        collapsePriorTutorSessions(currentSessionKey);
      }
      tutorSessionExpandedState.set(currentSessionKey, true);
      return;
    }

    for (const turn of chatTurns) {
      if (turn.id !== currentTurnId && turn.tutor && !getTutorSessionKey(turn)) {
        turn.tutorCollapsed = true;
      }
    }
  }

  function findLatestTutorSessionKeyBeforeTurn(currentTurnId) {
    let latestSessionKey = '';
    for (const turn of chatTurns) {
      if (turn.id === currentTurnId) return latestSessionKey;
      latestSessionKey = getTutorSessionKey(turn) || latestSessionKey;
    }
    return latestSessionKey;
  }

  function collapsePriorTutorSessions(currentSessionKey) {
    for (const turn of chatTurns) {
      const sessionKey = getTutorSessionKey(turn);
      if (sessionKey && sessionKey !== currentSessionKey) {
        tutorSessionExpandedState.set(sessionKey, false);
      }
    }
  }

  function renderTimeline() {
    if (!timeline) return;

    if (chatTurns.length === 0) {
      timeline.innerHTML = '<p class="student-empty-timeline">Ask a question to start a conversation. Guided math/formula tutor work, calculator checks, and final answers will appear here.</p>';
      updateComposerTutorChoices();
      return;
    }

    const copyableTurnId = findLatestCopyableTurnId();
    timeline.innerHTML = buildTimelineItems().map((item) => {
      if (item.type === 'tutorSession') return renderTutorSession(item, copyableTurnId);
      return item.turn.system
        ? renderSystemTurn(item.turn)
        : renderChatTurn(item.turn, copyableTurnId);
    }).join('');
    updateComposerTutorChoices();
  }

  function updateComposerTutorChoices() {
    const activeChoiceState = getActiveTutorChoiceState();
    const choices = activeChoiceState?.choices || [];
    updateInputPlaceholder(choices.length > 0);

    if (!composerTutorChoices) return;
    if (choices.length === 0) {
      composerTutorChoices.hidden = true;
      composerTutorChoices.innerHTML = '';
      return;
    }

    composerTutorChoices.hidden = false;
    composerTutorChoices.innerHTML = choices.map((choice) => `
      <button
        type="button"
        class="student-composer-choice-button student-tutor-control student-tutor-control--choice"
        data-tutor-choice="${escapeAttr(choice.number)}"
      >${escapeHtml(`${choice.number}. ${choice.label}`)}</button>
    `).join('');
  }

  function updateInputPlaceholder(hasChoiceStep) {
    if (!input) return;
    input.placeholder = hasChoiceStep ? 'Type choice number only' : defaultInputPlaceholder;
  }

  function getActiveTutorChoiceState() {
    const activeTurn = getCurrentActiveTutorTurn();
    const tutor = activeTurn?.tutor;
    if (!tutor) return null;

    const work = getTutorWork(tutor);
    const choices = getCurrentTutorChoices(tutor, work);
    return choices.length > 0 ? { tutor, work, choices } : null;
  }

  function isActiveTutorChoiceNumber(number) {
    const choiceNumber = String(number || '').trim();
    if (!choiceNumber) return false;

    const activeChoiceState = getActiveTutorChoiceState();
    return Boolean(activeChoiceState?.choices?.some((choice) => choice.number === choiceNumber));
  }

  function buildTimelineItems() {
    const items = [];
    const sessionsByKey = new Map();
    let latestFormulaSessionKey = '';
    let activeTutorSessionKey = '';

    for (const turn of chatTurns) {
      const sessionKey = getTutorSessionKey(turn);
      if (!sessionKey) {
        items.push({ type: 'turn', turn });
        continue;
      }

      let session = sessionsByKey.get(sessionKey);
      if (!session) {
        session = {
          type: 'tutorSession',
          key: sessionKey,
          turns: [],
          firstTurn: turn,
          lastTurn: turn,
          isActive: false,
          isComplete: false,
          isStopped: false,
          isCurrent: false
        };
        sessionsByKey.set(sessionKey, session);
        items.push(session);
      }

      session.turns.push(turn);
      session.lastTurn = turn;
      latestFormulaSessionKey = sessionKey;
    }

    activeTutorSessionKey = getTutorSessionKey(getCurrentActiveTutorTurn());

    for (const session of sessionsByKey.values()) {
      const latestTutor = session.lastTurn?.tutor || {};
      session.isActive = Boolean(activeTutorSessionKey && session.key === activeTutorSessionKey);
      session.isComplete = latestTutor.completed === true;
      session.isStopped = latestTutor.stopped === true;
      session.isCurrent = session.isActive || session.key === latestFormulaSessionKey;
    }

    return items;
  }

  function getTutorSessionKey(turn) {
    if (!turn || turn.system || turn.pending || turn.error || !turn.tutor) return '';

    const tutor = turn.tutor;
    const work = getTutorWork(tutor);
    if (!isStructuredFormulaTutor(tutor, work)) return '';

    const tutorProblemId = normalizeTutorSessionPart(
      work.tutorProblemId ||
      tutor.tutorProblemId ||
      tutor.problemInstanceId ||
      work.problemInstanceId ||
      tutor.sessionProblemId ||
      work.sessionProblemId
    );
    if (tutorProblemId) return ['formula-session', tutorProblemId].join('|');

    const originalQuestion = normalizeTutorSessionPart(
      work.originalQuestion ||
      tutor.originalQuestion ||
      turn.tutorSubmittedMessage ||
      turn.message
    );
    if (!originalQuestion) return `formula-session:${turn.id}`;

    const formulaId = normalizeTutorSessionPart(tutor.formulaId || work.formulaId || tutor.formula || work.formula);
    const solveFor = normalizeTutorSessionPart(work.solveFor || work.solvingFor || tutor.solveFor || tutor.solvingFor);
    return ['formula-session', originalQuestion, formulaId, solveFor].join('|');
  }

  function findLatestCopyableTurnId() {
    for (let index = chatTurns.length - 1; index >= 0; index -= 1) {
      const turn = chatTurns[index];
      if (isCopyableAnswerTurn(turn)) return turn.id;
    }
    return '';
  }

  function isCopyableAnswerTurn(turn) {
    if (!turn || turn.system || turn.pending || turn.error || !String(turn.response || '').trim()) return false;
    if (isRenderableFlashcardSession(turn.flashcardSession)) return false;

    if (!turn.tutor) return true;

    const work = getTutorWork(turn.tutor);
    const finalAnswer = work.finalAnswer || work.answer || turn.tutor.finalAnswerDisplay;
    return turn.tutor.completed === true && Boolean(String(finalAnswer || '').trim());
  }

  function renderSystemTurn(turn) {
    return `
      <article class="student-chat-turn" data-turn-id="${escapeAttr(turn.id)}">
        <div class="student-chat-message is-system">
          <div class="student-message-meta"><strong>Status</strong></div>
          <div class="student-message-bubble">${escapeHtml(turn.response)}</div>
        </div>
      </article>
    `;
  }

  function renderChatTurn(turn, copyableTurnId) {
    const route = turn.routeType
      ? `<span class="student-route-chip">${escapeHtml(formatRouteStatusLabel(turn.routeType, turn.confidence))}</span>`
      : '';
    const copyButton = turn.id !== copyableTurnId
      ? ''
      : `<button type="button" class="student-inline-button" data-copy-turn-id="${escapeAttr(turn.id)}">Copy Answer</button>`;
    const assistantClasses = [
      'student-chat-message',
      'is-assistant',
      turn.tutor ? 'has-tutor' : '',
      isRenderableFlashcardSession(turn.flashcardSession) ? 'has-flashcard-session' : '',
      turn.pending ? 'is-pending' : '',
      turn.error ? 'is-system' : ''
    ].filter(Boolean).join(' ');
    const assistantResponseHtml = renderAssistantResponseHtml(turn);

    return `
      <article class="student-chat-turn" data-turn-id="${escapeAttr(turn.id)}">
        <div class="student-chat-message is-user">
          <div class="student-message-meta"><strong>You</strong></div>
          <div class="student-message-bubble">${escapeHtml(turn.message)}</div>
        </div>
        <div class="${assistantClasses}">
          <div class="student-message-meta">
            <strong>Charlemagne</strong>
            ${route}
            <span class="student-message-actions">${copyButton}</span>
          </div>
          <div class="student-message-bubble">
            ${assistantResponseHtml}
            ${renderFlashcardSessionCard(turn.flashcardSession)}
            ${renderTutorCardHtml(turn)}
          </div>
        </div>
      </article>
    `;
  }

  function renderAssistantResponseHtml(turn) {
    const responseText = String(turn?.response || '').trim();
    if (!responseText) return '';
    if (isRenderableFlashcardSession(turn?.flashcardSession)) return '';
    if (!turn?.tutor || turn.pending || turn.error) return escapeHtml(responseText);

    const work = getTutorWork(turn.tutor);
    if (!isStructuredFormulaTutor(turn.tutor, work)) return escapeHtml(responseText);

    return escapeHtml(responseText);
  }

  function renderFlashcardSessionCard(session) {
    if (!isRenderableFlashcardSession(session)) return '';

    if (session.isComplete || session.completed) {
      const title = session.title || 'Flashcards';
      const reviewedCount = Number(session.reviewedCount) || Number(session.totalCards) || Number(session.cardCount) || 0;
      return `
        <section class="flashcard-session-card is-complete" aria-label="Flashcard practice complete">
          <div class="flashcard-session-title">Flashcard deck complete: ${escapeHtml(title)}</div>
          <p class="flashcard-session-progress">You reviewed ${escapeHtml(String(reviewedCount))} cards.</p>
          <div class="flashcard-session-actions">
            ${renderFlashcardActionButton('restart', 'Restart deck')}
          </div>
        </section>
      `;
    }

    const totalCards = Number(session.totalCards) || Number(session.cardCount) || 0;
    const cardNumber = Number(session.currentCardIndex) + 1;
    const progress = totalCards > 0 && cardNumber > 0 ? `Card ${cardNumber} of ${totalCards}` : '';
    const controls = Array.isArray(session.controls) && session.controls.length > 0
      ? session.controls
      : session.showingBack ? ['again', 'next', 'stop'] : ['show', 'next', 'stop'];

    return `
      <section class="flashcard-session-card" aria-label="Interactive flashcard session">
        <div class="flashcard-session-title">Flashcards: ${escapeHtml(session.title || 'Flashcards')}</div>
        ${progress ? `<div class="flashcard-session-progress">${escapeHtml(progress)}</div>` : ''}
        <p class="flashcard-session-front">${escapeHtml(session.front || '')}</p>
        ${session.back ? `<p class="flashcard-session-back">${escapeHtml(session.back)}</p>` : ''}
        <div class="flashcard-session-actions">
          ${controls.map((command) => renderFlashcardActionButton(command)).join('')}
        </div>
      </section>
    `;
  }

  function isRenderableFlashcardSession(session) {
    if (!session || typeof session !== 'object') return false;
    if (session.isComplete || session.completed) return true;
    return session.active === true;
  }

  function renderFlashcardActionButton(command, overrideLabel = '') {
    const action = String(command || '').trim();
    if (!action) return '';
    return `
      <button
        type="button"
        class="flashcard-session-action"
        data-flashcard-action="${escapeAttr(action)}"
      >${escapeHtml(overrideLabel || getFlashcardActionLabel(action))}</button>
    `;
  }

  function getFlashcardActionLabel(command) {
    if (command === 'show') return 'Show answer';
    if (command === 'again') return 'Again';
    if (command === 'next') return 'Next';
    if (command === 'stop') return 'Stop';
    if (command === 'restart') return 'Restart deck';
    return toTitleCase(command);
  }

  function renderTutorSession(session, copyableTurnId) {
    const expanded = getTutorSessionExpandedState(session);
    const latestTurn = session.lastTurn || {};
    const question = getTutorSessionQuestion(session);
    const questionSummary = summarizeTutorQuestion(question || latestTurn.message || 'Formula problem');
    const label = getTutorSessionLabel(session);
    const progress = formatTutorSessionProgress(session);
    const stateClass = session.isComplete ? 'is-complete' : session.isStopped ? 'is-stopped' : session.isActive ? 'is-active' : 'is-paused';
    const copyButton = session.turns.some((turn) => turn.id === copyableTurnId)
      ? `<button type="button" class="student-inline-button" data-copy-turn-id="${escapeAttr(copyableTurnId)}">Copy Answer</button>`
      : '';

    return `
      <article class="student-chat-turn student-tutor-session ${stateClass} ${expanded ? 'is-expanded' : 'is-collapsed'}" data-tutor-session-id="${escapeAttr(session.key)}">
        <div class="student-tutor-session-header">
          <div class="student-tutor-session-summary">
            <strong>${escapeHtml(questionSummary)}</strong>
            <span>${escapeHtml(label)}</span>
          </div>
          <div class="student-tutor-session-meta">
            <span>${escapeHtml(progress)}</span>
            ${copyButton}
            <button
              type="button"
              class="student-tutor-session-toggle"
              data-toggle-tutor-session-id="${escapeAttr(session.key)}"
              aria-expanded="${expanded ? 'true' : 'false'}"
            >${expanded ? 'Minimize' : 'Expand'}</button>
          </div>
        </div>
        <div class="student-tutor-session-panel" aria-hidden="${expanded ? 'false' : 'true'}">
          ${question ? `
            <div class="student-tutor-session-question">
              <strong>Original Question</strong>
              <p>${escapeHtml(question)}</p>
            </div>
          ` : ''}
          <div class="student-tutor-session-scroll">
            <div class="student-tutor-session-steps">
              ${session.turns.map((turn, index) => renderTutorSessionStep(turn, {
                isLatestActiveStep: session.isActive && turn.id === latestTurn.id,
                stepIndex: index,
                previousTurn: index > 0 ? session.turns[index - 1] : null
              })).join('')}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderTutorSessionStep(turn, options = {}) {
    const tutor = turn.tutor || {};
    const work = getTutorWork(tutor);
    const isCurrentStep = options.isLatestActiveStep === true;
    const stateClass = tutor.completed ? 'is-complete' : tutor.stopped ? 'is-stopped' : isCurrentStep ? 'is-current' : 'is-prior';
    const knownValues = getKnownValuesForTutor(tutor, work);
    const originalQuestion = work.originalQuestion || tutor.originalQuestion || '';
    const solveFor = work.solveFor || work.solvingFor || tutor.solveFor || tutor.solvingFor || '';
    const currentStep = getCurrentTutorPrompt(tutor, work);
    const answer = work.finalAnswer || work.answer || formatTutorAnswer(tutor.solveFor, tutor.finalAnswerDisplay);
    const calculatorCheck = formatTutorCalculatorCheck(work.calculatorCheck);
    const isFormulaTutor = isStructuredFormulaTutor(tutor, work);
    const showFormulaDetails = isFormulaTutor && shouldShowFormulaStepDetails(work);
    const showKnownValues = showFormulaDetails && shouldShowFormulaKnownValues(work, knownValues);
    const canUseCalculator = isCurrentStep && isFormulaTutor && tutor.active === true && !tutor.completed && !tutor.stopped;
    const showCalculator = canUseCalculator && shouldShowCalculator(turn.id, tutor, work, currentStep);
    const responseText = String(turn.response || '').trim();
    const stepStatus = getTutorStepStatus(tutor, isCurrentStep);
    if (isFormulaTutor && !isCurrentStep) {
      return renderCompactTutorSessionStep(turn, {
        tutor,
        work,
        currentStep,
        responseText,
        stepStatus,
        stepIndex: options.stepIndex,
        previousTurn: options.previousTurn,
        stateClass
      });
    }

    const answerHtml = renderTutorSessionAnswer(turn, options.stepIndex);
    const sideAnswerClass = answerHtml ? 'has-side-answer' : 'has-no-side-answer';
    const instructionHtml = isFormulaTutor
      ? renderTutorInstructionBlock({
        tutor,
        work,
        currentStep,
        responseText,
        stepStatus,
        isCurrentStep
      })
      : '';

    return `
      <section class="student-tutor-session-step ${stateClass} ${sideAnswerClass}" data-tutor-turn-id="${escapeAttr(turn.id)}">
        ${answerHtml}
        <div class="student-tutor-session-step-work">
          ${instructionHtml || `
            <div class="student-tutor-session-step-head">
              <strong>${escapeHtml(formatTutorProgress(tutor, work) || stepStatus)}</strong>
              <span>${escapeHtml(stepStatus)}</span>
            </div>
            ${responseText ? `<p class="student-tutor-session-response">${escapeHtml(responseText)}</p>` : ''}
          `}
          <div class="student-tutor-grid">
            ${!isFormulaTutor ? renderTutorDetail('Current Step', currentStep, 'student-tutor-current-step', { showWaiting: true }) : ''}
            ${showFormulaDetails ? renderTutorDetail('Solving For', solveFor, '', { showWaiting: true }) : ''}
            ${showFormulaDetails ? renderTutorDetail('Formula', work.formula || tutor.formula || '', 'student-tutor-formula', { showWaiting: true }) : ''}
            ${showKnownValues ? renderKnownValuesDetail(knownValues) : ''}
            ${isFormulaTutor && work.substitution ? renderTutorDetail('Substitution', work.substitution, 'student-tutor-substitution') : ''}
            ${calculatorCheck ? renderTutorDetail('Calculator check', calculatorCheck, 'student-tutor-check') : ''}
            ${answer ? renderTutorDetail('Final answer', answer, 'student-tutor-answer') : ''}
            ${!isFormulaTutor && tutor.currentHint ? renderTutorDetail('Hint', tutor.currentHint, 'is-wide') : ''}
          </div>
          ${isCurrentStep ? renderTutorAnswerChips(tutor, work) : ''}
          ${isCurrentStep && isFormulaTutor ? renderFormulaVisualMetadata(work.visualMetadata || tutor.visualMetadata, turn.id, { tutor, work }) : ''}
          ${isCurrentStep && shouldRenderInlineTutorChoices(tutor, work) ? renderTutorChoiceButtons(tutor, work) : ''}
          ${canUseCalculator ? renderCalculatorArea(turn.id, showCalculator) : ''}
          ${isCurrentStep ? renderTutorActions(turn, tutor, { hideCompletedAction: true }) : ''}
        </div>
      </section>
    `;
  }

  function renderCompactTutorSessionStep(turn, context = {}) {
    const tutor = context.tutor || turn.tutor || {};
    const work = context.work || getTutorWork(tutor);
    const submitted = getTutorSubmittedMessage(turn, context.stepIndex);
    const answeredStep = getAnsweredTutorStepContext(turn, {
      ...context,
      submitted
    });
    const progress = formatTutorInstructionProgress(answeredStep.tutor, answeredStep.work, context.stepStatus);
    const promptLabel = summarizeTutorStepPrompt(answeredStep.currentStep);
    const feedback = getTutorCompactFeedback(context.responseText);
    const finalAnswer = work.finalAnswer || work.answer || formatTutorAnswer(tutor.solveFor, tutor.finalAnswerDisplay);
    const expanded = tutorStepExpandedState.get(turn.id) === true;
    const expandedHtml = expanded ? renderTutorStepReviewDetails(turn, {
      tutor,
      work,
      reviewTutor: answeredStep.tutor,
      reviewWork: answeredStep.work,
      currentStep: answeredStep.currentStep,
      responseText: context.responseText,
      submitted
    }) : '';
    const classes = [
      'student-tutor-session-step',
      'student-tutor-session-step-compact',
      context.stateClass || '',
      expanded ? 'is-expanded' : '',
      finalAnswer ? 'has-final-answer' : ''
    ].filter(Boolean).join(' ');

    return `
      <section class="${escapeAttr(classes)}" data-tutor-turn-id="${escapeAttr(turn.id)}">
        <button
          type="button"
          class="student-tutor-history-row ${expanded ? 'is-expanded' : ''}"
          data-toggle-tutor-step-id="${escapeAttr(turn.id)}"
          aria-expanded="${expanded ? 'true' : 'false'}"
        >
          <span class="student-tutor-history-caret" aria-hidden="true">${expanded ? '▾' : '▸'}</span>
          <strong>${escapeHtml(progress || 'Saved step')}</strong>
          ${feedback ? `<span class="student-tutor-history-feedback">${escapeHtml(feedback)}</span>` : ''}
          ${promptLabel ? `<span class="student-tutor-history-prompt">${escapeHtml(promptLabel)}</span>` : ''}
          ${submitted ? `<span class="student-tutor-history-answer">Student answer: ${escapeHtml(formatTutorSubmittedMessage(submitted))}</span>` : ''}
        </button>
        ${expandedHtml}
        ${finalAnswer ? `<div class="student-tutor-history-final"><strong>Final Answer</strong><span>${escapeHtml(finalAnswer)}</span></div>` : ''}
      </section>
    `;
  }

  function getAnsweredTutorStepContext(turn, context = {}) {
    const currentTutor = context.tutor || turn.tutor || {};
    const currentWork = context.work || getTutorWork(currentTutor);
    const fallback = {
      tutor: currentTutor,
      work: currentWork,
      currentStep: context.currentStep
    };
    if (!context.submitted) return fallback;

    const previousTutor = context.previousTurn?.tutor || null;
    const previousWork = previousTutor ? getTutorWork(previousTutor) : {};
    if (!previousTutor || !isStructuredFormulaTutor(previousTutor, previousWork)) return fallback;

    const currentProblemId = String(currentTutor?.tutorProblemId || currentWork?.tutorProblemId || '').trim();
    const previousProblemId = String(previousTutor?.tutorProblemId || previousWork?.tutorProblemId || '').trim();
    if (currentProblemId && previousProblemId && currentProblemId !== previousProblemId) return fallback;

    return {
      tutor: previousTutor,
      work: previousWork,
      currentStep: getCurrentTutorPrompt(previousTutor, previousWork)
    };
  }

  function renderTutorStepReviewDetails(turn, context = {}) {
    const tutor = context.tutor || turn.tutor || {};
    const work = context.work || getTutorWork(tutor);
    const reviewTutor = context.reviewTutor || tutor;
    const reviewWork = context.reviewWork || work;
    const knownValues = getKnownValuesForTutor(reviewTutor, reviewWork);
    const rows = [
      ['Prompt', context.currentStep],
      ['Feedback', getTutorFeedbackLine(context.responseText, context.currentStep)],
      ['Student answer', context.submitted ? formatTutorSubmittedMessage(context.submitted) : ''],
      ['Hint', reviewTutor.currentHint],
      ['Formula', shouldShowFormulaStepDetails(reviewWork) ? reviewWork.formula || reviewTutor.formula || '' : ''],
      ['Known values', shouldShowFormulaKnownValues(reviewWork, knownValues) ? formatKnownValuesInline(knownValues) : ''],
      ['Substitution', reviewWork.substitution],
      ['Calculator check', formatTutorCalculatorCheck(reviewWork.calculatorCheck)]
    ];
    const visibleRows = rows.filter(([, value]) => String(value || '').trim());
    if (visibleRows.length === 0) return '';

    return `
      <div class="student-tutor-history-expanded" aria-label="Saved step review details">
        ${visibleRows.map(([label, value]) => `
          <div class="student-tutor-history-detail">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTutorInstructionBlock({ tutor, work, currentStep, responseText, stepStatus, isCurrentStep }) {
    const progress = formatTutorInstructionProgress(tutor, work, stepStatus);
    const prompt = String(currentStep || '').trim();
    const feedback = getTutorFeedbackLine(responseText, prompt);
    const hint = String(tutor?.currentHint || '').trim();
    const classes = [
      'student-tutor-instruction',
      isCurrentStep ? 'is-current' : 'is-saved',
      tutor?.completed ? 'is-complete' : '',
      tutor?.stopped ? 'is-stopped' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${escapeAttr(classes)}">
        <div class="student-tutor-instruction-head">
          <strong>${escapeHtml(progress)}</strong>
          <span>${escapeHtml(stepStatus || '')}</span>
        </div>
        ${feedback ? `<p class="student-tutor-instruction-feedback">${escapeHtml(feedback)}</p>` : ''}
        ${prompt ? `<p class="student-tutor-instruction-prompt">${escapeHtml(prompt)}</p>` : '<p class="student-tutor-instruction-prompt student-tutor-pending">Waiting...</p>'}
        ${hint ? `<p class="student-tutor-instruction-hint">Hint: ${escapeHtml(hint)}</p>` : ''}
      </div>
    `;
  }

  function renderTutorSessionAnswer(turn, stepIndex) {
    const message = getTutorSubmittedMessage(turn, stepIndex);
    if (!message) return '';

    return `
      <div class="student-tutor-session-answer">
        <strong>Student answer</strong>
        <p>${escapeHtml(formatTutorSubmittedMessage(message))}</p>
      </div>
    `;
  }

  function getTutorSubmittedMessage(turn, stepIndex) {
    if (stepIndex === 0) return '';
    return String(turn?.tutorSubmittedMessage || turn?.message || '').trim();
  }

  function formatTutorSubmittedMessage(message) {
    const text = String(message || '').trim();
    if (text === 'hint') return 'Asked for a hint';
    if (text === 'restart') return 'Restarted the tutor';
    if (text === 'stop') return 'Stopped the tutor';
    return text;
  }

  function getTutorSessionExpandedState(session) {
    if (!session) return false;
    if (tutorSessionExpandedState.has(session.key)) {
      return tutorSessionExpandedState.get(session.key) === true;
    }
    return session.isActive || session.isCurrent;
  }

  function toggleTutorSession(sessionKey) {
    if (!sessionKey) return;

    const session = buildTimelineItems()
      .find((item) => item.type === 'tutorSession' && item.key === sessionKey);
    const expanded = getTutorSessionExpandedState(session);
    tutorSessionExpandedState.set(sessionKey, !expanded);
    renderTimeline();
  }

  function toggleTutorStepReview(turnId) {
    if (!turnId) return;
    tutorStepExpandedState.set(turnId, tutorStepExpandedState.get(turnId) !== true);
    renderTimeline();
  }

  function getTutorSessionQuestion(session) {
    for (const turn of session?.turns || []) {
      const tutor = turn.tutor || {};
      const work = getTutorWork(tutor);
      const question = String(work.originalQuestion || tutor.originalQuestion || turn.tutorSubmittedMessage || turn.message || '').trim();
      if (question) return question;
    }
    return '';
  }

  function summarizeTutorQuestion(question) {
    return summarizeText(question, 112);
  }

  function summarizeText(value, maxLength) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
  }

  function getTutorSessionLabel(session) {
    const turn = session?.lastTurn || {};
    if (turn.routeType || turn.confidence) {
      return formatRouteStatusLabel(turn.routeType || 'formula_tutor', turn.confidence);
    }

    const tutor = turn.tutor || {};
    return getTutorTitle(tutor, getTutorWork(tutor));
  }

  function formatTutorSessionProgress(session) {
    const tutor = session?.lastTurn?.tutor || {};
    const work = getTutorWork(tutor);
    if (tutor.completed) return 'Complete';
    if (tutor.stopped) return 'Stopped';
    return formatTutorProgress(tutor, work) || 'In progress';
  }

  function getTutorStepStatus(tutor, isCurrentStep = false) {
    if (tutor?.completed) return 'Complete';
    if (tutor?.stopped) return 'Stopped';
    if (isCurrentStep && tutor?.active === true) return 'Current';
    return 'Saved';
  }

  function formatTutorInstructionProgress(tutor, work = {}, stepStatus = '') {
    const stepId = String(work?.currentStep?.id || tutor?.currentStep?.id || tutor?.stepId || '').trim();
    if (stepId === 'choose_method') return 'Choose method';
    return formatTutorProgress(tutor, work) || stepStatus || '';
  }

  function summarizeTutorStepPrompt(prompt) {
    const text = String(prompt || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    if (/\bmethod\b/.test(lower)) return 'Method choice';
    if (/\bgiven number\b/.test(lower)) return 'Given number';
    if (/\btop number\b/.test(lower)) return 'Top number';
    if (/\bbottom number\b/.test(lower)) return 'Bottom number';
    if (/\bunit\b.*\bcancel|\bcancel/.test(lower)) return 'Canceling unit';
    if (/\bfinal number\b/.test(lower)) return 'Final number';
    if (/\bmarker\b.*\btarget unit\b|\btarget unit\b/.test(lower)) return 'Target unit';
    return summarizeText(text, 64);
  }

  function getTutorCompactFeedback(response) {
    const text = String(response || '').trim();
    if (/^correct\b/i.test(text)) return 'Correct';
    if (/^not quite yet\b/i.test(text)) return 'Not quite';
    if (/^guided formula tutor stopped\b/i.test(text)) return 'Stopped';
    return '';
  }

  function getTutorFeedbackLine(response, currentPrompt = '') {
    const text = String(response || '').replace(/\r/g, '').trim();
    if (!text) return '';

    if (/^correct\b/i.test(text)) return 'Correct.';
    if (/^not quite yet\b/i.test(text)) {
      return compactTutorFeedback(text, currentPrompt) || 'Not quite yet.';
    }
    if (/^guided formula tutor stopped\b/i.test(text)) return 'Guided Formula Tutor stopped.';
    if (/^no problem\b/i.test(text)) return firstSentence(text);
    if (/^okay\b/i.test(text)) return firstSentence(text);
    return '';
  }

  function compactTutorFeedback(response, currentPrompt = '') {
    const prompt = String(currentPrompt || '').replace(/\s+/g, ' ').trim();
    const lines = String(response || '')
      .replace(/\r/g, '')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((line) => !/^step\s+\d+\s+of\s+\d+:?$/i.test(line))
      .filter((line) => !/^choose one:?$/i.test(line))
      .filter((line) => !/^click a choice or type only the number\.?$/i.test(line))
      .filter((line) => !prompt || line !== prompt);
    return lines.slice(0, 2).join(' ');
  }

  function firstSentence(value) {
    const sentence = String(value || '').trim().match(/^(.+?[.!?])(?:\s|$)/u);
    return sentence ? sentence[1] : String(value || '').split(/\n+/)[0].trim();
  }

  function renderTutorCardHtml(turn) {
    const tutor = turn.tutor;
    if (!tutor || typeof tutor !== 'object') return '';

    const work = getTutorWork(tutor);
    const isCurrentActiveTutor = isCurrentActiveTutorTurn(turn);
    if (turn.tutorCollapsed) {
      if (!tutor.completed && !tutor.stopped) return '';
      return renderCollapsedTutorCard(turn, tutor, work);
    }

    const title = getTutorTitle(tutor, work);
    const stateClass = tutor.completed ? 'is-complete' : tutor.stopped ? 'is-stopped' : isCurrentActiveTutor ? 'is-active' : 'is-paused';
    const progress = formatTutorProgress(tutor, work) || (tutor.completed ? 'Complete' : tutor.stopped ? 'Stopped' : '');
    const knownValues = getKnownValuesForTutor(tutor, work);
    const answer = work.finalAnswer || work.answer || formatTutorAnswer(tutor.solveFor, tutor.finalAnswerDisplay);
    const calculatorCheck = work.calculatorCheck?.display || '';
    const isFormulaTutor = isStructuredFormulaTutor(tutor, work);
    const showFormulaDetails = isFormulaTutor && shouldShowFormulaStepDetails(work);
    const showKnownValues = showFormulaDetails && shouldShowFormulaKnownValues(work, knownValues);
    const solveFor = work.solveFor || work.solvingFor || tutor.solveFor || tutor.solvingFor || '';
    const originalQuestion = work.originalQuestion || tutor.originalQuestion || '';
    const currentStep = getCurrentTutorPrompt(tutor, work);
    const canUseCalculator = isFormulaTutor && isCurrentActiveTutor;
    const showCalculator = canUseCalculator && shouldShowCalculator(turn.id, tutor, work, currentStep);
    const controlTutor = isCurrentActiveTutor ? tutor : { ...tutor, active: false };

    return `
      <section class="student-tutor-card ${stateClass}" data-tutor-card data-tutor-turn-id="${escapeAttr(turn.id)}">
        <div class="student-tutor-meta">
          <h2>${escapeHtml(title)}</h2>
          <span class="student-tutor-progress">${escapeHtml(progress)}</span>
        </div>
        <div class="student-tutor-body">
          <div class="student-tutor-grid">
            ${originalQuestion ? renderTutorDetail('Original Question', originalQuestion, 'student-tutor-original-question is-wide') : ''}
            ${renderTutorDetail('Current Step', currentStep, 'student-tutor-current-step', { showWaiting: true })}
            ${showFormulaDetails ? renderTutorDetail('Solving For', solveFor, '', { showWaiting: true }) : ''}
            ${showFormulaDetails ? renderTutorDetail('Formula', work.formula || tutor.formula || '', 'student-tutor-formula', { showWaiting: true }) : ''}
            ${showKnownValues ? renderKnownValuesDetail(knownValues) : ''}
            ${isFormulaTutor && work.substitution ? renderTutorDetail('Substitution', work.substitution, 'student-tutor-substitution') : ''}
            ${calculatorCheck ? renderTutorDetail('Calculator check', calculatorCheck, 'student-tutor-check') : ''}
            ${answer ? renderTutorDetail('Final answer', answer, 'student-tutor-answer') : ''}
            ${tutor.currentHint ? renderTutorDetail('Hint', tutor.currentHint, 'is-wide') : ''}
          </div>
          ${renderTutorAnswerChips(controlTutor, work)}
          ${isFormulaTutor ? renderFormulaVisualMetadata(work.visualMetadata || tutor.visualMetadata, turn.id, { tutor, work }) : ''}
          ${shouldRenderInlineTutorChoices(controlTutor, work) ? renderTutorChoiceButtons(controlTutor, work) : ''}
          ${canUseCalculator ? renderCalculatorArea(turn.id, showCalculator) : ''}
        </div>
        ${renderTutorActions(turn, controlTutor)}
      </section>
    `;
  }

  function renderCollapsedTutorCard(turn, tutor, work) {
    const summaryTitle = buildTutorSummaryTitle(tutor, work);
    const answer = conciseTutorAnswer(tutor, work);
    const action = turn.tutorExpanded ? 'Hide work' : 'Show work';
    return `
      <button type="button" class="student-tutor-summary" data-toggle-work-id="${escapeAttr(turn.id)}" aria-expanded="false">
        <strong>${escapeHtml(summaryTitle)}</strong>
        <span>${escapeHtml(answer ? `Answer: ${answer} — ${action}` : action)}</span>
      </button>
    `;
  }

  function renderTutorDetail(label, value, extraClass, options = {}) {
    const text = String(value || '').trim();
    if (!text && !options.showWaiting) return '';
    return `
      <div class="student-tutor-detail ${escapeAttr(extraClass || '')}">
        <strong>${escapeHtml(label)}</strong>
        <p class="${text ? '' : 'student-tutor-pending'}">${escapeHtml(text || 'Waiting...')}</p>
      </div>
    `;
  }

  function renderKnownValuesDetail(values) {
    const safeValues = Array.isArray(values) ? values : [];
    const content = safeValues.length > 0
      ? safeValues.map((value) => {
        const label = [value.label, value.symbol ? `(${value.symbol})` : ''].filter(Boolean).join(' ');
        return `${label}: ${value.display || ''}`.trim();
      }).join('; ')
      : 'No known values yet.';

    return renderTutorDetail('Known Values', content, 'student-tutor-known');
  }

  function formatKnownValuesInline(values) {
    const safeValues = Array.isArray(values) ? values : [];
    return safeValues.map((value) => {
      const label = [value.label, value.symbol ? `(${value.symbol})` : ''].filter(Boolean).join(' ');
      return `${label}: ${value.display || ''}`.trim();
    }).filter(Boolean).join('; ');
  }

  function shouldShowFormulaStepDetails(work = {}) {
    if (work?.isComplete === true && work?.selectedMethod === 'stair_step') return false;
    if (work?.isComplete === true && isUnit1ConversionVisual(work?.visualMetadata)) return false;
    return work?.currentStep?.suppressFormulaDetails !== true;
  }

  function shouldShowFormulaKnownValues(work = {}, knownValues = []) {
    if (work?.currentStep?.suppressKnownValues === true) return false;
    return Array.isArray(knownValues) && knownValues.length > 0;
  }

  function shouldRenderInlineTutorChoices(tutor = {}, work = {}) {
    if (work?.currentStep?.suppressInlineChoices === true) return false;
    return Array.isArray(tutor?.currentStep?.choices) && tutor.currentStep.choices.length > 0;
  }

  function renderFormulaVisualMetadata(visual, turnId, context = {}) {
    if (!visual || typeof visual !== 'object') return '';
    if (context?.work?.currentStep?.id === 'choose_method' && Array.isArray(visual.methodChoices)) return '';
    if (context?.work?.isComplete === true && context?.work?.selectedMethod === 'stair_step') return '';
    if (visual.visualType === 'metric_stair_step') {
      return renderMetricStairStepVisual(visual, turnId, context);
    }
    if (visual.visualType === 'picket_fence') {
      return renderPicketFenceVisual(visual, turnId, context);
    }
    if (visual.visualType === 'scientific_notation_decimal_move') {
      return renderScientificNotationVisual(visual, turnId);
    }
    return '';
  }

  function renderMetricStairStepVisual(visual, turnId, context = {}) {
    const steps = Array.isArray(visual.steps) ? visual.steps : [];
    const startUnit = String(visual.startUnit || '').trim();
    const targetUnit = String(visual.targetUnit || '').trim();
    const baseUnit = String(visual.baseUnit || '').trim();
    const startIndex = findMetricStepIndex(steps, visual.startPrefix, startUnit, baseUnit);
    const targetIndex = findMetricStepIndex(steps, visual.targetPrefix, targetUnit, baseUnit);
    const stateKey = metricStairStepKey(turnId);
    const savedIndex = metricStairStepState.has(stateKey) ? Number(metricStairStepState.get(stateKey)) : startIndex;
    const currentIndex = clampMetricStepIndex(Number.isFinite(savedIndex) ? savedIndex : startIndex, steps);
    const savedPreviewIndex = metricStairStepPreviewState.has(stateKey) ? Number(metricStairStepPreviewState.get(stateKey)) : currentIndex;
    const previewIndex = clampMetricStepIndex(Number.isFinite(savedPreviewIndex) ? savedPreviewIndex : currentIndex, steps);
    const currentStep = steps[currentIndex] || steps[startIndex] || {};
    const displayStep = steps[previewIndex] || currentStep || {};
    const startStep = steps[startIndex] || {};
    const startExponent = Number(startStep.exponent) || 0;
    const currentExponent = Number(displayStep.exponent) || 0;
    const startValue = Number(visual.startValue);
    const computedCurrentValue = Number.isFinite(startValue)
      ? startValue * (10 ** (startExponent - currentExponent))
      : visual.startValue;
    const stepValue = getMetricStairStepValue(visual, displayStep, previewIndex);
    const currentValue = stepValue?.value ?? computedCurrentValue;
    const currentUnit = metricUnitForStep(displayStep, baseUnit);
    const finalDisplay = `${formatMetricVisualValue(visual.resultValue)} ${visual.resultUnit || targetUnit}`.trim();
    const completed = context?.tutor?.completed === true || context?.work?.isComplete === true;
    const decimalMove = visual.decimalMove || {};
    const moveDirection = String(decimalMove.direction || '').trim();
    const places = Number(decimalMove.places);
    const moveMessage = moveDirection && Number.isFinite(places)
      ? `Move decimal ${moveDirection} ${places} place${places === 1 ? '' : 's'}.`
      : '';

    return `
      <section class="metric-stair-step-visual" data-metric-stair-step-id="${escapeAttr(stateKey)}" aria-label="Metric stair-step visual">
        <div class="metric-stair-step-header">
          <strong>Metric stair-step</strong>
          <span>${escapeHtml(`${startUnit} to ${targetUnit}`)}</span>
        </div>
        <div class="metric-stair-step-status-panel" aria-live="polite">
          <span class="metric-stair-step-current-display">Current <strong data-metric-stair-step-current-value>${escapeHtml(stepValue?.display || `${formatMetricVisualValue(currentValue)} ${currentUnit}`)}</strong></span>
          <span>Start <strong>${escapeHtml(`${formatMetricVisualValue(visual.startValue)} ${startUnit}`)}</strong></span>
          <span>Target <strong>${escapeHtml(targetUnit)}</strong></span>
        </div>
        <div class="metric-stair-step-track metric-stair-step-ladder" role="list" aria-label="Metric ladder">
          ${steps.map((step, index) => renderMetricStairStepButton(step, index, {
            baseUnit,
            currentIndex,
            previewIndex,
            startIndex,
            targetIndex,
            stateKey
          })).join('')}
        </div>
        <div class="metric-stair-step-controls">
          <button type="button" class="metric-stair-step-control student-tutor-control student-tutor-control--workspace" data-metric-stair-step-move="decimal-left" data-metric-stair-step-id="${escapeAttr(stateKey)}">Move decimal left</button>
          <button type="button" class="metric-stair-step-control student-tutor-control student-tutor-control--workspace" data-metric-stair-step-move="decimal-right" data-metric-stair-step-id="${escapeAttr(stateKey)}">Move decimal right</button>
        </div>
        <p class="metric-stair-step-preview-hint">Preview: hover over a step to see the value change. Click or tap the target unit to check it.</p>
        <p class="metric-stair-step-helper">Moving down/right means multiply by 10 each step. Moving up/left means divide by 10 each step.</p>
        <p class="metric-stair-step-note">${completed ? `${escapeHtml(moveMessage)} Answer: <strong>${escapeHtml(finalDisplay)}</strong>` : `${escapeHtml(moveMessage)} Answer appears when the marker reaches ${escapeHtml(targetUnit)}.`}</p>
      </section>
    `;
  }

  function renderMetricStairStepButton(step, index, context) {
    const classes = [
      'metric-stair-step-button',
      'student-tutor-control',
      'student-tutor-control--workspace',
      index === context.currentIndex ? 'is-current' : '',
      index === context.previewIndex && index !== context.currentIndex ? 'is-preview' : '',
      index === context.startIndex ? 'is-start' : '',
      index === context.targetIndex ? 'is-target' : ''
    ].filter(Boolean).join(' ');
    const unitLabel = metricUnitForStep(step, context.baseUnit);
    const badges = [
      index === context.startIndex ? 'Start' : '',
      index === context.targetIndex ? 'Target' : ''
    ].filter(Boolean).join(' / ');

    return `
      <button
        type="button"
        class="${escapeAttr(classes)}"
        data-metric-stair-step-id="${escapeAttr(context.stateKey)}"
        data-metric-stair-step-index="${escapeAttr(index)}"
        style="--metric-step-offset: ${escapeAttr(index)};"
        role="listitem"
      >
        <span class="metric-stair-step-dot" aria-hidden="true"></span>
        <span class="metric-stair-step-label">${escapeHtml(unitLabel)}</span>
        ${badges ? `<span class="metric-stair-step-badge">${escapeHtml(badges)}</span>` : ''}
      </button>
    `;
  }

  function getMetricStairStepValue(visual, step, index) {
    const values = Array.isArray(visual?.stepValues) ? visual.stepValues : [];
    const byIndex = values[index];
    if (byIndex) return byIndex;
    const label = String(step?.label || '').trim();
    return values.find((item) => String(item?.label || '').trim() === label) || null;
  }

  function handleMetricStairStepClick(control) {
    if (!control || !timeline?.contains(control)) return false;
    const stateKey = control.getAttribute('data-metric-stair-step-id') || '';
    if (!stateKey) return false;

    const visual = findMetricStairStepVisualForStateKey(stateKey);
    const steps = Array.isArray(visual?.steps) ? visual.steps : [];
    if (steps.length === 0) return true;

    const startIndex = findMetricStepIndex(steps, visual.startPrefix, visual.startUnit, visual.baseUnit);
    const currentIndex = metricStairStepState.has(stateKey)
      ? Number(metricStairStepState.get(stateKey))
      : startIndex;
    const directIndex = Number(control.getAttribute('data-metric-stair-step-index'));
    const movement = control.getAttribute('data-metric-stair-step-move') || '';
    let nextIndex = Number.isFinite(directIndex) ? directIndex : currentIndex;
    if (movement === 'up' || movement === 'decimal-left') nextIndex = currentIndex - 1;
    if (movement === 'down' || movement === 'decimal-right') nextIndex = currentIndex + 1;

    const clampedIndex = clampMetricStepIndex(nextIndex, steps);
    const targetIndex = findMetricStepIndex(steps, visual.targetPrefix, visual.targetUnit, visual.baseUnit);
    metricStairStepState.set(stateKey, clampedIndex);
    metricStairStepPreviewState.set(stateKey, clampedIndex);
    renderTimeline();
    if (shouldAutoCompleteMetricStairStep(control, visual, stateKey, clampedIndex, targetIndex)) {
      metricStairStepCompletionState.add(stateKey);
      window.setTimeout(() => {
        sendTutorCommand(getMetricStairStepCompletionAnswer(visual));
      }, 0);
    }
    return true;
  }

  function handleTimelinePreview(event) {
    const control = event.target.closest('[data-metric-stair-step-index]');
    if (!control || !timeline?.contains(control)) return;
    const stateKey = control.getAttribute('data-metric-stair-step-id') || '';
    const index = Number(control.getAttribute('data-metric-stair-step-index'));
    if (!stateKey || !Number.isFinite(index)) return;
    const visual = findMetricStairStepVisualForStateKey(stateKey);
    const steps = Array.isArray(visual?.steps) ? visual.steps : [];
    if (steps.length === 0) return;
    const previewIndex = clampMetricStepIndex(index, steps);
    metricStairStepPreviewState.set(stateKey, previewIndex);
    updateMetricStairStepPreviewInPlace(stateKey, visual, previewIndex);
  }

  function handleTimelinePreviewClear(event) {
    const visualElement = event.target.closest('.metric-stair-step-visual');
    if (!visualElement || !timeline?.contains(visualElement)) return;
    const relatedTarget = event.relatedTarget;
    if (relatedTarget && visualElement.contains(relatedTarget)) return;
    const stateKey = visualElement.getAttribute('data-metric-stair-step-id') || '';
    if (!stateKey || !metricStairStepPreviewState.has(stateKey)) return;
    metricStairStepPreviewState.delete(stateKey);
    const visual = findMetricStairStepVisualForStateKey(stateKey);
    const steps = Array.isArray(visual?.steps) ? visual.steps : [];
    const startIndex = findMetricStepIndex(steps, visual?.startPrefix, visual?.startUnit, visual?.baseUnit);
    const currentIndex = metricStairStepState.has(stateKey) ? Number(metricStairStepState.get(stateKey)) : startIndex;
    updateMetricStairStepPreviewInPlace(stateKey, visual, clampMetricStepIndex(currentIndex, steps));
  }

  function updateMetricStairStepPreviewInPlace(stateKey, visual, previewIndex) {
    const visualElement = timeline?.querySelector(`.metric-stair-step-visual[data-metric-stair-step-id="${cssEscape(stateKey)}"]`);
    if (!visualElement) return false;
    const steps = Array.isArray(visual?.steps) ? visual.steps : [];
    const index = clampMetricStepIndex(previewIndex, steps);
    const displayStep = steps[index] || {};
    const stepValue = getMetricStairStepValue(visual, displayStep, index);
    const currentDisplay = visualElement.querySelector('[data-metric-stair-step-current-value]');
    if (currentDisplay) {
      currentDisplay.textContent = stepValue?.display || buildMetricStairStepDisplay(visual, displayStep, index);
    }
    visualElement.querySelectorAll('[data-metric-stair-step-index]').forEach((button) => {
      const buttonIndex = Number(button.getAttribute('data-metric-stair-step-index'));
      button.classList.toggle('is-preview', Number.isFinite(buttonIndex) && buttonIndex === index && !button.classList.contains('is-current'));
    });
    return true;
  }

  function buildMetricStairStepDisplay(visual, step, index) {
    const steps = Array.isArray(visual?.steps) ? visual.steps : [];
    const baseUnit = String(visual?.baseUnit || '').trim();
    const startIndex = findMetricStepIndex(steps, visual?.startPrefix, visual?.startUnit, baseUnit);
    const startStep = steps[startIndex] || {};
    const startExponent = Number(startStep.exponent) || 0;
    const currentExponent = Number(step?.exponent) || 0;
    const startValue = Number(visual?.startValue);
    const value = Number.isFinite(startValue)
      ? startValue * (10 ** (startExponent - currentExponent))
      : visual?.startValue;
    return `${formatMetricVisualValue(value)} ${metricUnitForStep(step, baseUnit)}`.trim();
  }

  function shouldAutoCompleteMetricStairStep(control, visual, stateKey, currentIndex, targetIndex) {
    if (currentIndex !== targetIndex) return false;
    if (metricStairStepCompletionState.has(stateKey)) return false;
    if (!isLiveTutorControl(control)) return false;
    const activeTurn = getCurrentActiveTutorTurn();
    const tutor = activeTurn?.tutor || {};
    const work = getTutorWork(tutor);
    return work?.selectedMethod === 'stair_step' && work?.currentStep?.id === 'move_marker_to_target';
  }

  function getMetricStairStepCompletionAnswer(visual) {
    return String(visual?.autoCompleteAnswer || `${formatMetricVisualValue(visual?.resultValue)} ${visual?.resultUnit || visual?.targetUnit || ''}`).trim();
  }

  function findMetricStairStepVisualForStateKey(stateKey) {
    const turnId = String(stateKey || '').replace(/^metric-stair-step:/, '');
    const turn = findTurn(turnId);
    const tutor = turn?.tutor || {};
    const work = getTutorWork(tutor);
    const visual = work.visualMetadata || tutor.visualMetadata || null;
    return visual?.visualType === 'metric_stair_step' ? visual : null;
  }

  function metricStairStepKey(turnId) {
    return `metric-stair-step:${String(turnId || '').trim()}`;
  }

  function findMetricStepIndex(steps, prefixLabel, unit, baseUnit) {
    const byPrefix = steps.findIndex((step) => String(step?.label || '') === String(prefixLabel || ''));
    if (byPrefix >= 0) return byPrefix;

    const byUnit = steps.findIndex((step) => metricUnitForStep(step, baseUnit) === String(unit || ''));
    return byUnit >= 0 ? byUnit : 0;
  }

  function clampMetricStepIndex(index, steps) {
    const max = Math.max(0, (Array.isArray(steps) ? steps.length : 1) - 1);
    return Math.max(0, Math.min(max, Number(index) || 0));
  }

  function metricUnitForStep(step, baseUnit) {
    const label = String(step?.label || '').trim();
    const base = String(baseUnit || '').trim();
    if (!label) return base;
    if (label === 'UNIT') return base;
    return `${label}${base}`;
  }

  function formatMetricVisualValue(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value || '').trim();
    if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 12 });
    if (Number.isInteger(number)) return String(number);
    return number.toLocaleString('en-US', {
      maximumFractionDigits: 12,
      useGrouping: false
    });
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
  }

  function renderPicketFenceVisual(visual, turnId, context = {}) {
    const cells = Array.isArray(visual.cells) ? visual.cells : [];
    const cancellations = Array.isArray(visual.cancellationSteps) ? visual.cancellationSteps : [];
    const stateKey = picketFenceKey(turnId);
    const progress = 0;
    const fillContext = buildPicketFenceFillContext(visual, context, progress);
    const given = visual.given || {};
    const arithmetic = visual.arithmetic || {};
    const resultDisplay = `${formatPicketFenceNumber(arithmetic.resultValue)} ${arithmetic.resultUnit || visual.targetUnit || ''}`.trim();
    const finalAnswerSection = getPicketFenceSection(visual, 'final_answer');
    const finalAnswerFilled = isPicketFenceSectionFilled(finalAnswerSection, fillContext);
    const finalAnswerDisplay = finalAnswerFilled ? escapeHtml(resultDisplay) : picketFencePlaceholder(finalAnswerSection, 'final answer');

    return `
      <section class="picket-fence-visual" data-picket-fence-id="${escapeAttr(stateKey)}" aria-label="Picket fence method visual">
        <div class="picket-fence-header">
          <strong>Picket fence method</strong>
          <span>${escapeHtml(`Target: ${visual.targetUnit || ''}`.trim())}</span>
        </div>
        <div class="picket-fence-summary">
          <span>Given: <strong>${renderPicketFenceSectionValue(visual, 'given_value', fillContext, `${formatPicketFenceNumber(given.value)} ${given.unit || ''}`.trim(), 'given value + unit')}</strong></span>
          <span>Answer: <strong>${finalAnswerDisplay}</strong></span>
        </div>
        <div class="picket-fence-cells" aria-label="Conversion factor cells">
          ${cells.map((cell, index) => renderPicketFenceCell(cell, index, {
            stateKey,
            progress,
            visual,
            fillContext
          })).join('')}
        </div>
        <div class="picket-fence-cancellations" aria-label="Unit cancellations">
          ${cancellations.map((step, index) => `
            <button
              type="button"
              class="picket-fence-cancellation picket-fence-cancel-unit student-tutor-control student-tutor-control--workspace ${isPicketFenceSectionFilled(getPicketFenceSection(visual, 'canceled_units'), fillContext) ? 'is-revealed' : ''}"
              data-picket-fence-cancel-answer="${escapeAttr(step.unit || '')}"
            >
              ${isPicketFenceSectionFilled(getPicketFenceSection(visual, 'canceled_units'), fillContext) ? `${escapeHtml(step.unit || '')} canceled` : `Cancel ${escapeHtml(step.unit || '')}`}
            </button>
          `).join('')}
        </div>
      </section>
    `;
  }

  function isUnit1ConversionVisual(visual) {
    const type = String(visual?.visualType || '');
    return type === 'metric_stair_step' ||
      type === 'picket_fence' ||
      type === 'temperature_conversion' ||
      type === 'scientific_notation_decimal_move';
  }

  function renderPicketFenceCell(cell, index, context) {
    const classes = [
      'picket-fence-cell',
      index <= context.progress ? 'is-revealed' : 'is-pending',
      index === context.progress ? 'is-highlighted' : ''
    ].filter(Boolean).join(' ');
    const numerator = renderPicketFenceTerm(cell?.numerator, context.visual, {
      filled: isPicketFenceSectionFilled(getPicketFenceSection(context.visual, cell?.numeratorSectionId), context.fillContext),
      placeholder: picketFencePlaceholder(getPicketFenceSection(context.visual, cell?.numeratorSectionId), 'top')
    });
    const denominator = renderPicketFenceTerm(cell?.denominator, context.visual, {
      filled: !cell?.denominatorSectionId || isPicketFenceSectionFilled(getPicketFenceSection(context.visual, cell?.denominatorSectionId), context.fillContext),
      placeholder: cell?.denominatorSectionId ? picketFencePlaceholder(getPicketFenceSection(context.visual, cell.denominatorSectionId), 'bottom') : ''
    });

    return `
      <div
        class="${escapeAttr(classes)}"
      >
        <span class="picket-fence-multiply">${index === 0 ? 'Given' : '&times;'}</span>
        <span class="picket-fence-fraction">
          <span class="picket-fence-numerator">${numerator || '&nbsp;'}</span>
          <span class="picket-fence-denominator">${denominator || '&nbsp;'}</span>
        </span>
      </div>
    `;
  }

  function renderPicketFenceTerm(value, visual, options = {}) {
    if (options.filled === false) return options.placeholder || '<span class="picket-fence-placeholder">___</span>';
    const text = String(value || '').trim();
    if (!text) return '';
    const match = text.match(/^(.+?)\s+([A-Za-zµ]+)$/u);
    if (!match) return escapeHtml(text);
    const [, amount, unit] = match;
    const unitClass = isPicketFenceCancelledUnit(unit, visual) ? 'picket-fence-cancelled' : 'picket-fence-final-unit';
    return `${escapeHtml(amount)} <span class="${unitClass}">${escapeHtml(unit)}</span>`;
  }

  function buildPicketFenceFillContext(visual, context = {}, progress = 0) {
    const tutor = context.tutor || {};
    const work = context.work || {};
    const completedSteps = new Set([
      ...(Array.isArray(work.completedSteps) ? work.completedSteps : []),
      ...(Array.isArray(tutor.completedSteps) ? tutor.completedSteps : [])
    ].map((step) => String(step || '').trim()).filter(Boolean));
    const completed = tutor.completed === true || work.isComplete === true;
    return {
      completed,
      completedSteps,
      progress,
      sections: Array.isArray(visual?.fillableSections) ? visual.fillableSections : []
    };
  }

  function getPicketFenceSection(visual, sectionId) {
    if (!sectionId) return null;
    const sections = Array.isArray(visual?.fillableSections) ? visual.fillableSections : [];
    return sections.find((section) => String(section?.id || '') === String(sectionId || '')) || null;
  }

  function isPicketFenceSectionFilled(section, fillContext = {}) {
    if (!section) return true;
    if (fillContext.completed) return true;
    const completedSteps = fillContext.completedSteps instanceof Set ? fillContext.completedSteps : new Set();
    const unlockSteps = Array.isArray(section.unlockAfterStepIds) ? section.unlockAfterStepIds : [];
    if (unlockSteps.some((stepId) => completedSteps.has(String(stepId || '')))) return true;
    return Number(fillContext.progress) > 0 && section.id === 'given_value';
  }

  function renderPicketFenceSectionValue(visual, sectionId, fillContext, fallbackValue, fallbackPlaceholder) {
    const section = getPicketFenceSection(visual, sectionId);
    if (isPicketFenceSectionFilled(section, fillContext)) {
      return escapeHtml(section?.value || fallbackValue || '');
    }
    return picketFencePlaceholder(section, fallbackPlaceholder);
  }

  function picketFencePlaceholder(section, fallback = 'pending') {
    const label = section?.placeholder || fallback || 'pending';
    return `<span class="picket-fence-placeholder">${escapeHtml(label)}</span>`;
  }

  function handlePicketFenceClick(control) {
    if (!control || !timeline?.contains(control)) return false;
    const stateKey = control.getAttribute('data-picket-fence-id') || '';
    if (!stateKey) return false;

    const visual = findPicketFenceVisualForStateKey(stateKey);
    if (!visual) return true;

    const cells = Array.isArray(visual.cells) ? visual.cells : [];
    const currentProgress = getPicketFenceProgress(stateKey, visual);
    const action = control.getAttribute('data-picket-fence-action') || '';
    const directCell = Number(control.getAttribute('data-picket-fence-cell'));
    const directCancellation = Number(control.getAttribute('data-picket-fence-cancellation'));
    let nextProgress = currentProgress;

    if (action === 'reset') nextProgress = 0;
    if (action === 'next') nextProgress = currentProgress + 1;
    if (Number.isFinite(directCell)) nextProgress = directCell;
    if (Number.isFinite(directCancellation)) nextProgress = cells.length + directCancellation;

    picketFenceState.set(stateKey, clampPicketFenceProgress(nextProgress, visual));
    renderTimeline();
    return true;
  }

  function findPicketFenceVisualForStateKey(stateKey) {
    const turnId = String(stateKey || '').replace(/^picket-fence:/, '');
    const turn = findTurn(turnId);
    const tutor = turn?.tutor || {};
    const work = getTutorWork(tutor);
    const visual = work.visualMetadata || tutor.visualMetadata || null;
    return visual?.visualType === 'picket_fence' ? visual : null;
  }

  function picketFenceKey(turnId) {
    return `picket-fence:${String(turnId || '').trim()}`;
  }

  function getPicketFenceProgress(stateKey, visual) {
    const saved = picketFenceState.has(stateKey) ? Number(picketFenceState.get(stateKey)) : 0;
    return clampPicketFenceProgress(Number.isFinite(saved) ? saved : 0, visual);
  }

  function clampPicketFenceProgress(progress, visual) {
    const cells = Array.isArray(visual?.cells) ? visual.cells : [];
    const cancellations = Array.isArray(visual?.cancellationSteps) ? visual.cancellationSteps : [];
    const max = Math.max(0, cells.length + cancellations.length);
    return Math.max(0, Math.min(max, Number(progress) || 0));
  }

  function isPicketFenceCancelledUnit(unit, visual) {
    const normalizedUnit = normalizePicketFenceUnit(unit);
    const targetUnit = normalizePicketFenceUnit(visual?.arithmetic?.resultUnit || visual?.targetUnit);
    if (!normalizedUnit || normalizedUnit === targetUnit) return false;
    const cancellations = Array.isArray(visual?.cancellationSteps) ? visual.cancellationSteps : [];
    return cancellations.some((step) => normalizePicketFenceUnit(step?.unit) === normalizedUnit);
  }

  function normalizePicketFenceUnit(unit) {
    const text = String(unit || '').trim().toLowerCase();
    if (text.length > 2 && text.endsWith('s')) return text.slice(0, -1);
    return text;
  }

  function formatPicketFenceNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value || '').trim();
    if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 12 });
    if (Number.isInteger(number)) return String(number);
    return number.toLocaleString('en-US', {
      maximumFractionDigits: 12,
      useGrouping: false
    });
  }

  function renderScientificNotationVisual(visual, turnId) {
    const stateKey = scientificNotationKey(turnId);
    const move = visual.decimalMove || {};
    const finalSignedMoves = scientificNotationSignedMoves(move);
    const currentSignedMoves = getScientificNotationSignedMoves(stateKey, finalSignedMoves);
    const places = Math.abs(Number(move.places) || 0);
    const currentValue = calculateScientificNotationCurrentValue(visual, currentSignedMoves);
    const startDisplay = scientificNotationStartDisplay(visual);
    const targetFormat = visual.mode === 'to_standard' ? 'standard notation' : 'scientific notation';
    const rule = scientificNotationRule(visual);
    const moveDirection = String(move.direction || '').trim();
    const finalDisplay = visual.resultDisplay || String(visual.resultValue || '').trim();

    return `
      <section class="scientific-notation-visual" data-scientific-notation-id="${escapeAttr(stateKey)}" aria-label="Scientific notation decimal mover visual">
        <div class="scientific-notation-header">
          <strong>Scientific notation decimal mover</strong>
          <span>${escapeHtml(targetFormat)}</span>
        </div>
        <div class="scientific-notation-summary">
          <span>Start: <strong>${escapeHtml(startDisplay)}</strong></span>
          <span>Move: <strong>${escapeHtml(`${moveDirection || 'unknown'} ${places} place${places === 1 ? '' : 's'}`)}</strong></span>
          <span>Final result: <strong>${escapeHtml(finalDisplay)}</strong></span>
        </div>
        <div class="scientific-notation-number" aria-label="Current decimal position">
          ${renderScientificNotationNumber(currentValue)}
        </div>
        <div class="scientific-notation-move">
          <span>Current value: <strong>${escapeHtml(formatScientificNotationNumber(currentValue))}</strong></span>
          <span>Moves shown: <strong>${escapeHtml(String(Math.abs(currentSignedMoves)))} / ${escapeHtml(String(places))}</strong></span>
          <span>Coefficient: <strong>${escapeHtml(formatScientificNotationNumber(visual.coefficient))}</strong></span>
          <span>Exponent: <strong>${escapeHtml(String(visual.exponent ?? ''))}</strong></span>
        </div>
        <p class="scientific-notation-rule">${escapeHtml(rule)}</p>
        <div class="scientific-notation-controls">
          <button type="button" class="scientific-notation-control student-tutor-control student-tutor-control--workspace" data-scientific-notation-action="left" data-scientific-notation-id="${escapeAttr(stateKey)}">Move left</button>
          <button type="button" class="scientific-notation-control student-tutor-control student-tutor-control--workspace" data-scientific-notation-action="right" data-scientific-notation-id="${escapeAttr(stateKey)}">Move right</button>
          <button type="button" class="scientific-notation-control student-tutor-control student-tutor-control--workspace" data-scientific-notation-action="next" data-scientific-notation-id="${escapeAttr(stateKey)}">Show next move</button>
          <button type="button" class="scientific-notation-control student-tutor-control student-tutor-control--workspace" data-scientific-notation-action="reset" data-scientific-notation-id="${escapeAttr(stateKey)}">Reset</button>
        </div>
      </section>
    `;
  }

  function renderScientificNotationNumber(value) {
    const text = formatScientificNotationNumber(value);
    const parts = text.split('.');
    if (parts.length < 2) {
      return `<span>${escapeHtml(text)}</span><span class="scientific-notation-decimal">.</span>`;
    }
    return `
      <span>${escapeHtml(parts[0])}</span>
      <span class="scientific-notation-decimal">.</span>
      <span>${escapeHtml(parts.slice(1).join('.'))}</span>
    `;
  }

  function handleScientificNotationVisualClick(control) {
    if (!control || !timeline?.contains(control)) return false;
    const stateKey = control.getAttribute('data-scientific-notation-id') || '';
    if (!stateKey) return false;

    const visual = findScientificNotationVisualForStateKey(stateKey);
    if (!visual) return true;

    const finalSignedMoves = scientificNotationSignedMoves(visual.decimalMove || {});
    const currentSignedMoves = getScientificNotationSignedMoves(stateKey, finalSignedMoves);
    const action = control.getAttribute('data-scientific-notation-action') || '';
    let nextSignedMoves = currentSignedMoves;

    if (action === 'reset') nextSignedMoves = 0;
    if (action === 'left') nextSignedMoves = currentSignedMoves - 1;
    if (action === 'right') nextSignedMoves = currentSignedMoves + 1;
    if (action === 'next') {
      if (finalSignedMoves > currentSignedMoves) nextSignedMoves = currentSignedMoves + 1;
      if (finalSignedMoves < currentSignedMoves) nextSignedMoves = currentSignedMoves - 1;
    }

    scientificNotationState.set(stateKey, clampScientificNotationSignedMoves(nextSignedMoves, finalSignedMoves));
    renderTimeline();
    return true;
  }

  function findScientificNotationVisualForStateKey(stateKey) {
    const turnId = String(stateKey || '').replace(/^scientific-notation:/, '');
    const turn = findTurn(turnId);
    const tutor = turn?.tutor || {};
    const work = getTutorWork(tutor);
    const visual = work.visualMetadata || tutor.visualMetadata || null;
    return visual?.visualType === 'scientific_notation_decimal_move' ? visual : null;
  }

  function scientificNotationKey(turnId) {
    return `scientific-notation:${String(turnId || '').trim()}`;
  }

  function getScientificNotationSignedMoves(stateKey, finalSignedMoves) {
    const saved = scientificNotationState.has(stateKey) ? Number(scientificNotationState.get(stateKey)) : 0;
    return clampScientificNotationSignedMoves(Number.isFinite(saved) ? saved : 0, finalSignedMoves);
  }

  function scientificNotationSignedMoves(decimalMove) {
    const places = Math.abs(Number(decimalMove?.places) || 0);
    return decimalMove?.direction === 'right' ? places : -places;
  }

  function clampScientificNotationSignedMoves(signedMoves, finalSignedMoves) {
    const max = Math.abs(Number(finalSignedMoves) || 0);
    return Math.max(-max, Math.min(max, Number(signedMoves) || 0));
  }

  function calculateScientificNotationCurrentValue(visual, signedMoves) {
    const startValue = visual.mode === 'to_standard' ? Number(visual.coefficient) : Number(visual.startValue);
    if (!Number.isFinite(startValue)) return visual.startValue || visual.coefficient || '';
    return startValue * (10 ** signedMoves);
  }

  function scientificNotationStartDisplay(visual) {
    if (visual.mode === 'to_standard') {
      return `${formatScientificNotationNumber(visual.coefficient)} x 10^${visual.exponent}`;
    }
    return formatScientificNotationNumber(visual.startValue);
  }

  function scientificNotationRule(visual) {
    const mode = visual.mode || '';
    const exponent = Number(visual.exponent) || 0;
    if (mode === 'to_standard') {
      return exponent >= 0
        ? 'Positive exponent to standard notation: move the decimal right.'
        : 'Negative exponent to standard notation: move the decimal left.';
    }
    return exponent >= 0
      ? 'Large number to scientific notation: move the decimal left for a positive exponent.'
      : 'Small decimal to scientific notation: move the decimal right for a negative exponent.';
  }

  function formatScientificNotationNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value || '').trim();
    if (number === 0) return '0';
    if (Math.abs(number) >= 1000) return number.toLocaleString('en-US', { maximumFractionDigits: 12 });
    return number.toLocaleString('en-US', {
      maximumFractionDigits: 12,
      useGrouping: false
    });
  }

  function getKnownValuesForTutor(tutor, work = {}) {
    if (Array.isArray(work.knownValues) && work.knownValues.length > 0) return work.knownValues;
    if (Array.isArray(tutor?.knownValues) && tutor.knownValues.length > 0) return tutor.knownValues;
    if (Array.isArray(tutor?.formulaWork?.knownValues) && tutor.formulaWork.knownValues.length > 0) {
      return tutor.formulaWork.knownValues;
    }
    return [];
  }

  function formatRouteStatusLabel(routeType, confidence) {
    const routeLabel = formatRouteLabel(routeType || 'unknown');
    const confidenceLabel = formatConfidenceLabel(confidence || '');
    return confidenceLabel ? `${routeLabel} / ${confidenceLabel}` : routeLabel;
  }

  function formatRouteLabel(routeType) {
    const normalized = String(routeType || '').trim().toLowerCase();
    if (normalized === 'formula_tutor') return 'Formula Tutor';
    if (normalized === 'motion_force_knowledge_tutor') return 'General Tutor';
    if (normalized === 'tutor_control') return 'Tutor Control';
    if (normalized === 'app_feedback') return 'App Feedback';
    if (normalized === 'science_formula') return 'Formula Answer';
    if (normalized === 'student_context_clarification') return 'Clarifying Question';
    if (normalized === 'why_this_matters_followup') return 'Why This Matters';
    return toTitleCase(String(routeType || 'unknown').replace(/[_-]+/g, ' '));
  }

  function formatConfidenceLabel(confidence) {
    const text = String(confidence || '').trim();
    return text ? toTitleCase(text.replace(/[_-]+/g, ' ')) : '';
  }

  function renderTutorActions(turn, tutor, options = {}) {
    if (tutor.completed || tutor.stopped) {
      if (options.hideCompletedAction) return '';
      return `
        <div class="student-tutor-actions">
          <button type="button" class="panel-action-button student-tutor-control student-tutor-control--tool" data-toggle-work-id="${escapeAttr(turn.id)}">Hide work</button>
        </div>
      `;
    }
    if (tutor.active !== true) return '';
    return `
      <div class="student-tutor-actions">
        <button type="button" class="panel-action-button student-tutor-control student-tutor-control--tool" data-tutor-action="hint">Hint</button>
        <button type="button" class="panel-action-button student-tutor-control student-tutor-control--tool" data-tutor-action="restart">Restart</button>
        <button type="button" class="panel-action-button student-tutor-control student-tutor-control--tool student-tutor-control--danger" data-tutor-action="stop">Stop</button>
      </div>
    `;
  }

  function renderTutorChoiceButtons(tutor, work = {}) {
    if (!tutor || tutor.active !== true || tutor.completed || tutor.stopped) return '';

    const choices = getCurrentTutorChoices(tutor, work);
    if (choices.length === 0) return '';

    return `
      <div class="student-tutor-choices" aria-label="Answer choices">
        ${choices.map((choice) => `
          <button
            type="button"
            class="student-tutor-choice-button student-tutor-control student-tutor-control--choice"
            data-tutor-choice="${escapeAttr(choice.number)}"
          >${escapeHtml(`${choice.number}. ${choice.label}`)}</button>
        `).join('')}
      </div>
    `;
  }

  function renderTutorAnswerChips(tutor, work = {}) {
    if (!tutor || tutor.active !== true || tutor.completed || tutor.stopped) return '';
    const chips = getCurrentTutorAnswerChips(tutor, work);
    if (chips.length === 0) return '';

    return `
      <div class="student-tutor-answer-chips" aria-label="Helpful answer options">
        <span class="student-tutor-answer-chip-label">Quick choices:</span>
        ${chips.map((chip) => `
          <button
            type="button"
            class="student-tutor-answer-chip student-tutor-control student-tutor-control--helper"
            data-tutor-answer-chip="${escapeAttr(chip.value)}"
          >${escapeHtml(chip.label)}</button>
        `).join('')}
      </div>
    `;
  }

  function getCurrentTutorAnswerChips(tutor, work = {}) {
    const step = work.currentStep || tutor.currentStep || {};
    if (!Array.isArray(step.answerChips)) return [];
    return step.answerChips
      .map((chip) => ({
        label: String(chip?.label || chip?.value || '').trim(),
        value: String(chip?.value || chip?.label || '').trim()
      }))
      .filter((chip) => chip.label && chip.value);
  }

  function getCurrentTutorChoices(tutor, work = {}) {
    const step = work.currentStep || tutor.currentStep || {};
    if (!Array.isArray(step.choices)) return [];
    return step.choices
      .map((choice) => ({
        number: String(choice?.number || '').trim(),
        label: String(choice?.label || '').trim()
      }))
      .filter((choice) => choice.number && choice.label);
  }

  function renderCalculatorArea(turnId, showCalculator) {
    if (!showCalculator) {
      return `
        <button
          type="button"
          class="panel-action-button student-calculator-toggle student-tutor-control student-tutor-control--tool"
          data-calculator-toggle-id="${escapeAttr(turnId)}"
          aria-expanded="false"
        >Calculator</button>
      `;
    }

    return renderCalculatorHtml();
  }

  function renderCalculatorHtml() {
    return `
      <div class="student-calculator" aria-label="Guided Formula Tutor calculator">
        <div class="student-calculator-display" role="status" aria-live="polite">${escapeHtml(formatCalculatorExpression(calculatorExpression) || '0')}</div>
        <div class="student-calculator-keys">
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="7">7</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="8">8</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="9">9</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-operator" data-calculator-key="/">÷</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="4">4</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="5">5</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="6">6</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-operator" data-calculator-key="*">×</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="1">1</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="2">2</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="3">3</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-operator" data-calculator-key="-">−</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key="0">0</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool" data-calculator-key=".">.</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-clear" data-calculator-key="clear">C</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-operator" data-calculator-key="+">+</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-backspace" data-calculator-key="backspace">⌫</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-sqrt" data-calculator-key="sqrt">√</button>
          <button type="button" class="student-calculator-button student-tutor-control student-tutor-control--tool is-equals" data-calculator-key="equals">=</button>
        </div>
        <button type="button" class="student-calculator-use-result student-tutor-control student-tutor-control--tool" data-calculator-use-result>Use result</button>
      </div>
    `;
  }

  function isStructuredFormulaTutor(tutor, work = {}) {
    return Boolean(tutor?.tutorCategory === 'formula' || tutor?.formulaId || work.formula);
  }

  function shouldShowCalculator(turnId, tutor, work, currentStepText) {
    if (calculatorOpenTurnIds.has(turnId)) return true;
    return shouldAutoOpenCalculator(tutor, work, currentStepText);
  }

  function shouldAutoOpenCalculator(tutor, work, currentStepText) {
    if (!tutor?.active || tutor.completed || tutor.stopped) return false;
    if (work.calculatorCheck?.display || work.substitution) return true;

    const currentStep = work.currentStep || tutor.currentStep || {};
    const stepText = [
      currentStep.id,
      currentStep.type,
      currentStep.prompt,
      currentStepText
    ].map((part) => String(part || '').toLowerCase()).join(' ');

    return /\b(calculate|calculation|arithmetic|substitute|substitution)\b/.test(stepText) ||
      /\bwhat is\s+[-+*\/×÷√()0-9.\s^]+\??$/i.test(String(currentStep.prompt || currentStepText || ''));
  }

  function getTutorWork(tutor) {
    return tutor?.work && typeof tutor.work === 'object' ? tutor.work : {};
  }

  function formatTutorCalculatorCheck(calculatorCheck) {
    if (!calculatorCheck) return '';
    if (typeof calculatorCheck === 'string') return calculatorCheck;
    if (calculatorCheck.display) return calculatorCheck.display;

    const expression = String(calculatorCheck.expression || '').trim();
    const value = String(calculatorCheck.displayValue || calculatorCheck.value || '').trim();
    return [expression, value].filter(Boolean).join(' = ');
  }

  function getTutorTitle(tutor, work = {}) {
    const baseTitle = getTutorBaseTitle(tutor, work);
    if (tutor?.completed) return `${baseTitle} Complete`;
    if (tutor?.stopped) return `${baseTitle} Stopped`;
    return baseTitle;
  }

  function getTutorBaseTitle(tutor, work = {}) {
    const category = String(tutor?.tutorCategory || '').trim().toLowerCase();
    const tutorType = String(tutor?.tutorType || tutor?.routeType || '').trim().toLowerCase();
    const label = String(tutor?.tutorLabel || '').trim();

    if (category === 'formula' || tutorType === 'formula_tutor' || tutor?.formulaId || work.formula) return label || 'Formula Tutor';
    if (category === 'concept' || tutorType === 'concept_tutor') return label || 'Concept Tutor';
    if (category === 'general' || tutorType === 'motion_force_knowledge_tutor') return label || 'General Tutor';
    return label || 'Tutor';
  }

  function getCurrentTutorPrompt(tutor, work = {}) {
    if (tutor?.completed) return 'Final answer ready.';
    if (tutor?.stopped) return 'Guided math/formula tutor stopped.';
    return work.currentStep?.prompt || work.currentStep?.label || tutor?.currentStepPrompt || tutor?.currentStep?.prompt || '';
  }

  function formatTutorProgress(tutor, work = {}) {
    const totalSteps = Number(work.totalSteps) || Number(tutor?.totalSteps) || 0;
    if (!totalSteps) return '';
    const stepNumber = Number(work.stepNumber) || Number(tutor?.stepNumber) || Number(tutor?.currentStepIndex) + 1;
    return `Step ${stepNumber} of ${totalSteps}`;
  }

  function buildTutorSummaryTitle(tutor, work) {
    const originalQuestion = String(work.originalQuestion || tutor?.originalQuestion || '').toLowerCase();
    const solveFor = String(work.solveFor || tutor?.solveFor || '').trim();
    if (solveFor === 'time' && /\bsound\b|\blightning\b/.test(originalQuestion)) return 'Sound travel time';
    if (solveFor) return `${toTitleCase(solveFor)} work`;
    return tutor?.tutorLabel || 'Guided math/formula tutor work';
  }

  function conciseTutorAnswer(tutor, work) {
    const solveFor = String(work.solveFor || tutor?.solveFor || '').trim();
    const fullAnswer = String(work.finalAnswer || work.answer || formatTutorAnswer(solveFor, tutor?.finalAnswerDisplay) || '').trim();
    if (!fullAnswer) return '';
    if (solveFor) {
      return fullAnswer.replace(new RegExp(`^${escapeRegExp(solveFor)}\\s*=\\s*`, 'i'), '');
    }
    return fullAnswer;
  }

  function formatTutorAnswer(label, value) {
    const answer = String(value || '').trim();
    const solveFor = String(label || '').trim();
    if (solveFor && answer) return `${solveFor} = ${answer}`;
    return answer;
  }

  function handleTimelineClick(event) {
    const sessionToggleButton = event.target.closest('[data-toggle-tutor-session-id]');
    if (sessionToggleButton && timeline.contains(sessionToggleButton)) {
      toggleTutorSession(sessionToggleButton.getAttribute('data-toggle-tutor-session-id') || '');
      return;
    }

    const toggleButton = event.target.closest('[data-toggle-work-id]');
    if (toggleButton && timeline.contains(toggleButton)) {
      toggleTutorWork(toggleButton.getAttribute('data-toggle-work-id') || '');
      return;
    }

    const calculatorToggle = event.target.closest('[data-calculator-toggle-id]');
    if (calculatorToggle && timeline.contains(calculatorToggle)) {
      openCalculatorForTurn(calculatorToggle.getAttribute('data-calculator-toggle-id') || '');
      return;
    }

    const copyButton = event.target.closest('[data-copy-turn-id]');
    if (copyButton && timeline.contains(copyButton)) {
      copyTurnAnswer(copyButton.getAttribute('data-copy-turn-id') || '');
      return;
    }

    const tutorStepToggleButton = event.target.closest('[data-toggle-tutor-step-id]');
    if (tutorStepToggleButton && timeline.contains(tutorStepToggleButton)) {
      toggleTutorStepReview(tutorStepToggleButton.getAttribute('data-toggle-tutor-step-id') || '');
      return;
    }

    const metricStairStepControl = event.target.closest('[data-metric-stair-step-index], [data-metric-stair-step-move]');
    if (metricStairStepControl && handleMetricStairStepClick(metricStairStepControl)) {
      return;
    }

    const picketFenceCancelAnswer = event.target.closest('[data-picket-fence-cancel-answer]');
    if (picketFenceCancelAnswer && timeline.contains(picketFenceCancelAnswer)) {
      if (!isLiveTutorControl(picketFenceCancelAnswer)) return;
      sendTutorCommand(picketFenceCancelAnswer.getAttribute('data-picket-fence-cancel-answer') || '');
      return;
    }

    const picketFenceControl = event.target.closest('[data-picket-fence-action], [data-picket-fence-cell], [data-picket-fence-cancellation]');
    if (picketFenceControl && handlePicketFenceClick(picketFenceControl)) {
      return;
    }

    const scientificNotationControl = event.target.closest('[data-scientific-notation-action]');
    if (scientificNotationControl && handleScientificNotationVisualClick(scientificNotationControl)) {
      return;
    }

    const tutorButton = event.target.closest('[data-tutor-action]');
    if (tutorButton && timeline.contains(tutorButton)) {
      if (!isLiveTutorControl(tutorButton)) return;
      sendTutorCommand(tutorButton.getAttribute('data-tutor-action') || '');
      return;
    }

    const tutorChoiceButton = event.target.closest('[data-tutor-choice]');
    if (tutorChoiceButton && timeline.contains(tutorChoiceButton)) {
      if (!isLiveTutorControl(tutorChoiceButton)) return;
      sendTutorCommand(tutorChoiceButton.getAttribute('data-tutor-choice') || '');
      return;
    }

    const tutorAnswerChip = event.target.closest('[data-tutor-answer-chip]');
    if (tutorAnswerChip && timeline.contains(tutorAnswerChip)) {
      if (!isLiveTutorControl(tutorAnswerChip)) return;
      sendTutorCommand(tutorAnswerChip.getAttribute('data-tutor-answer-chip') || '');
      return;
    }

    const flashcardButton = event.target.closest('[data-flashcard-action]');
    if (flashcardButton && timeline.contains(flashcardButton)) {
      sendFlashcardCommand(flashcardButton.getAttribute('data-flashcard-action') || '');
      return;
    }

    const calculatorButton = event.target.closest('[data-calculator-key]');
    if (calculatorButton && timeline.contains(calculatorButton)) {
      handleCalculatorKey(calculatorButton.getAttribute('data-calculator-key') || '');
      return;
    }

    const calculatorUseButton = event.target.closest('[data-calculator-use-result]');
    if (calculatorUseButton && timeline.contains(calculatorUseButton)) {
      useCalculatorResult();
    }
  }

  function handleComposerTutorChoiceClick(event) {
    const tutorChoiceButton = event.target.closest('[data-tutor-choice]');
    if (!tutorChoiceButton || !composerTutorChoices?.contains(tutorChoiceButton)) return;
    const choiceNumber = tutorChoiceButton.getAttribute('data-tutor-choice') || '';
    if (!isActiveTutorChoiceNumber(choiceNumber)) return;
    sendTutorCommand(choiceNumber);
  }

  function toggleTutorWork(turnId) {
    const turn = findTurn(turnId);
    if (!turn || !turn.tutor) return;
    turn.tutorCollapsed = !turn.tutorCollapsed;
    turn.tutorExpanded = !turn.tutorCollapsed;
    renderTimeline();
  }

  function openCalculatorForTurn(turnId) {
    if (!turnId) return;
    calculatorOpenTurnIds.add(turnId);
    renderTimeline();
    updateCalculatorDisplay();
  }

  async function copyTurnAnswer(turnId) {
    const turn = findTurn(turnId);
    const text = buildCopyText(turn);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showTeacherToolsWarning('Answer copied.');
    } catch {
      showTeacherToolsWarning('Could not copy from this browser.');
    }
  }

  function buildCopyText(turn) {
    if (!turn) return lastAnswerText;
    const work = getTutorWork(turn.tutor);
    return work.finalAnswer || work.answer || turn.response || lastAnswerText;
  }

  async function sendTutorCommand(command) {
    if (!command || !sessionIsValid) return;

    const turnId = addPendingTurn(command);
    setSendingState();

    try {
      const data = await sendStudentMessage(command);
      renderStudentMessageResult(data, command, { turnId });
    } catch (error) {
      renderStudentError(turnId, error);
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  async function sendFlashcardCommand(command) {
    if (!command || !sessionIsValid) return;

    const turnId = addPendingTurn(command);
    setSendingState();

    try {
      const data = await sendStudentMessage(command);
      renderStudentMessageResult(data, command, { turnId });
    } catch (error) {
      renderStudentError(turnId, error);
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  function handleClearClick() {
    chatTurns.splice(0, chatTurns.length);
    lastAnswerText = '';
    activeCalculatorStepKey = '';
    resetCalculator({ silent: true });
    routeInfo.textContent = 'No route yet';
    renderTimeline();
  }

  function scrollTimelineToBottom() {
    if (!timeline) return;
    const activeSessionScroll = timeline.querySelector('.student-tutor-session.is-expanded.is-active .student-tutor-session-scroll');
    if (activeSessionScroll) {
      activeSessionScroll.scrollTop = activeSessionScroll.scrollHeight;
    }
    timeline.scrollTop = timeline.scrollHeight;
  }

  function handleCalculatorKey(key) {
    if (!key) return;

    if (key === 'clear') {
      resetCalculator();
      return;
    }

    if (key === 'backspace') {
      calculatorExpression = calculatorExpression.slice(0, -1);
      calculatorJustEvaluated = false;
      updateCalculatorDisplay();
      return;
    }

    if (key === 'equals') {
      calculateExpression();
      return;
    }

    if (key === 'sqrt') {
      calculateSquareRoot();
      return;
    }

    appendCalculatorKey(key);
  }

  function appendCalculatorKey(key) {
    if (!/^[0-9.+\-*/]$/.test(key)) return;

    const isOperator = /[+\-*/]/.test(key);
    if (calculatorExpression === 'Error') {
      calculatorExpression = '';
    }
    if (calculatorJustEvaluated && !isOperator) {
      calculatorExpression = '';
    }
    if (isOperator && !calculatorExpression.trim()) return;
    if (key === '.' && calculatorCurrentNumberHasDecimal()) return;
    if (isOperator && /[+\-*/]\s*$/.test(calculatorExpression)) {
      calculatorExpression = calculatorExpression.replace(/[+\-*/]\s*$/, `${key} `);
      updateCalculatorDisplay();
      return;
    }

    calculatorJustEvaluated = false;
    calculatorExpression = `${calculatorExpression}${isOperator ? ` ${key} ` : key}`.replace(/\s+/g, ' ').trimStart();
    if (calculatorExpression.length > 42) {
      calculatorExpression = calculatorExpression.slice(0, 42).trim();
    }
    updateCalculatorDisplay();
  }

  function calculatorCurrentNumberHasDecimal() {
    const currentNumber = calculatorExpression.split(/[+\-*/]/).pop() || '';
    return currentNumber.includes('.');
  }

  function calculateExpression() {
    try {
      const result = evaluateCalculatorExpression(calculatorExpression);
      calculatorExpression = formatCalculatorResult(result);
      calculatorJustEvaluated = true;
      useCalculatorResult();
    } catch {
      calculatorExpression = 'Error';
      calculatorJustEvaluated = true;
    }
    updateCalculatorDisplay();
  }

  function calculateSquareRoot() {
    try {
      const value = calculatorExpression.trim()
        ? evaluateCalculatorExpression(calculatorExpression)
        : 0;
      if (value < 0) throw new Error('Cannot take square root of negative value');
      calculatorExpression = formatCalculatorResult(Math.sqrt(value));
      calculatorJustEvaluated = true;
      useCalculatorResult();
    } catch {
      calculatorExpression = 'Error';
      calculatorJustEvaluated = true;
    }
    updateCalculatorDisplay();
  }

  function resetCalculator(options = {}) {
    calculatorExpression = '';
    calculatorJustEvaluated = false;
    if (!options.silent) updateCalculatorDisplay();
  }

  function resetCalculatorForTutorStepChange(tutor) {
    const nextKey = getActiveTutorStepKey(tutor);
    if (!nextKey) {
      if (activeCalculatorStepKey) resetCalculator({ silent: true });
      activeCalculatorStepKey = '';
      return;
    }

    if (nextKey !== activeCalculatorStepKey) {
      activeCalculatorStepKey = nextKey;
      resetCalculator({ silent: true });
    }
  }

  function getActiveTutorStepKey(tutor) {
    if (!tutor || tutor.active !== true || tutor.completed || tutor.stopped) return '';
    const work = getTutorWork(tutor);
    const step = work.currentStep || tutor.currentStep || {};
    return [
      tutor.tutorCategory || '',
      work.originalQuestion || tutor.originalQuestion || '',
      work.formula || tutor.formula || '',
      tutor.formulaId || work.formulaId || '',
      tutor.solveFor || work.solveFor || '',
      step.id || tutor.stepId || '',
      step.stepNumber || tutor.stepNumber || tutor.currentStepIndex || ''
    ].map((part) => String(part || '').trim()).join('|');
  }

  function useCalculatorResult() {
    const value = String(calculatorExpression || '').trim();
    if (!value || value === 'Error' || !sessionIsValid || !input) return;
    input.value = value;
    input.focus();
  }

  function updateCalculatorDisplay() {
    const calculatorDisplay = timeline?.querySelector(
      '.student-tutor-session-step.is-current .student-calculator-display, .student-tutor-card.is-active .student-calculator-display'
    );
    if (!calculatorDisplay) return;
    calculatorDisplay.textContent = formatCalculatorExpression(calculatorExpression) || '0';
  }

  function formatCalculatorExpression(value) {
    return String(value || '')
      .replaceAll('*', '×')
      .replaceAll('/', '÷')
      .replaceAll('-', '−');
  }

  function evaluateCalculatorExpression(value) {
    const expression = String(value || '')
      .replaceAll('×', '*')
      .replaceAll('÷', '/')
      .replaceAll('−', '-')
      .trim();

    if (!expression || expression === 'Error' || !/^[0-9+\-*/.\s]+$/.test(expression)) {
      throw new Error('Invalid calculator expression');
    }

    const tokens = tokenizeCalculatorExpression(expression);
    if (!tokens.length) throw new Error('Invalid calculator expression');

    const multiplied = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token === '*' || token === '/') {
        const previous = multiplied.pop();
        const next = tokens[index + 1];
        if (typeof previous !== 'number' || typeof next !== 'number') {
          throw new Error('Invalid calculator expression');
        }
        if (token === '/' && next === 0) throw new Error('Cannot divide by zero');
        multiplied.push(token === '*' ? previous * next : previous / next);
        index += 1;
      } else {
        multiplied.push(token);
      }
    }

    let result = multiplied[0];
    if (typeof result !== 'number') throw new Error('Invalid calculator expression');
    for (let index = 1; index < multiplied.length; index += 2) {
      const operator = multiplied[index];
      const next = multiplied[index + 1];
      if ((operator !== '+' && operator !== '-') || typeof next !== 'number') {
        throw new Error('Invalid calculator expression');
      }
      result = operator === '+' ? result + next : result - next;
    }

    if (!Number.isFinite(result)) throw new Error('Invalid calculator result');
    return result;
  }

  function tokenizeCalculatorExpression(expression) {
    const tokens = [];
    let index = 0;
    let expectingNumber = true;

    while (index < expression.length) {
      const character = expression[index];
      if (/\s/.test(character)) {
        index += 1;
        continue;
      }

      if (/[+\-]/.test(character) && expectingNumber) {
        const signedNumber = readCalculatorNumber(expression, index);
        tokens.push(signedNumber.value);
        index = signedNumber.nextIndex;
        expectingNumber = false;
        continue;
      }

      if (/[0-9.]/.test(character)) {
        const number = readCalculatorNumber(expression, index);
        tokens.push(number.value);
        index = number.nextIndex;
        expectingNumber = false;
        continue;
      }

      if (/[+\-*/]/.test(character) && !expectingNumber) {
        tokens.push(character);
        index += 1;
        expectingNumber = true;
        continue;
      }

      throw new Error('Invalid calculator token');
    }

    if (expectingNumber) throw new Error('Calculator expression ended early');
    return tokens;
  }

  function readCalculatorNumber(expression, startIndex) {
    let index = startIndex;
    let sign = '';
    if (/[+\-]/.test(expression[index])) {
      sign = expression[index];
      index += 1;
    }

    let raw = '';
    let decimalCount = 0;
    while (index < expression.length && /[0-9.]/.test(expression[index])) {
      if (expression[index] === '.') decimalCount += 1;
      raw += expression[index];
      index += 1;
    }

    if (!raw || raw === '.' || decimalCount > 1) {
      throw new Error('Invalid calculator number');
    }

    const value = Number(`${sign}${raw}`);
    if (!Number.isFinite(value)) throw new Error('Invalid calculator number');
    return { value, nextIndex: index };
  }

  function formatCalculatorResult(value) {
    const rounded = Math.round((value + Number.EPSILON) * 100000000) / 100000000;
    return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function maybeCelebrateTutorCompletion(tutor, work, context = {}) {
    if (!fireworks || !context.submittedMessage || !tutor?.completed || tutor?.stopped) return;

    const finalAnswer = getTutorFinalAnswer(tutor, work);
    if (!finalAnswer) return;

    const completionKey = [
      tutor.tutorCategory || tutor.tutorType || '',
      work.originalQuestion || tutor.originalQuestion,
      work.formula || tutor.formula || work.topic || tutor.topic || work.id || tutor.id,
      finalAnswer
    ].map((part) => String(part || '').trim()).join('|');

    if (!completionKey || completionKey === completedCelebrationKey) return;
    completedCelebrationKey = completionKey;
    showTutorFireworks();
  }

  function getTutorFinalAnswer(tutor, work = {}) {
    return String(work.finalAnswer || work.answer || tutor?.finalAnswerDisplay || '').trim();
  }

  function showTutorFireworks() {
    if (!fireworks) return;

    window.clearTimeout(fireworksTimer);
    fireworks.classList.remove('is-active');
    fireworks.hidden = true;
    fireworks.replaceChildren();

    if (prefersReducedMotion()) return;

    fireworks.appendChild(createTutorFireworkFinale());
    fireworks.hidden = false;
    void fireworks.offsetWidth;
    fireworks.classList.add('is-active');
    fireworksTimer = window.setTimeout(() => {
      fireworks.classList.remove('is-active');
      fireworks.hidden = true;
      fireworks.replaceChildren();
    }, FIREWORKS_DURATION_MS);
  }

  function createTutorFireworkFinale() {
    const fragment = document.createDocumentFragment();
    let particleCount = 0;
    const append = (node) => {
      if (particleCount >= FIREWORKS_MAX_PARTICLES) return;
      fragment.appendChild(node);
      particleCount += 1;
    };

    addBurst(append, {
      name: 'megaBurst',
      originX: 50,
      originY: 34,
      count: 52,
      minDistance: 100,
      maxDistance: 250,
      minSize: 8,
      maxSize: 17,
      delay: 0,
      delaySpread: 180,
      minDuration: 1300,
      maxDuration: 1900,
      trailEvery: 3
    });
    addBurst(append, {
      name: 'sideBurstLeft',
      originX: 18,
      originY: 38,
      count: 24,
      minDistance: 74,
      maxDistance: 180,
      minSize: 7,
      maxSize: 14,
      delay: 260,
      delaySpread: 170,
      minDuration: 1150,
      maxDuration: 1700,
      trailEvery: 4
    });
    addBurst(append, {
      name: 'sideBurstRight',
      originX: 82,
      originY: 36,
      count: 24,
      minDistance: 74,
      maxDistance: 180,
      minSize: 7,
      maxSize: 14,
      delay: 380,
      delaySpread: 160,
      minDuration: 1150,
      maxDuration: 1700,
      trailEvery: 4
    });
    addSparkleRain(append, {
      name: 'sparkleRain',
      count: 34,
      delay: 720,
      delaySpread: 1100
    });
    addRingShockwave(append, {
      name: 'ringShockwave',
      originX: 50,
      originY: 34,
      count: 3,
      delay: 70,
      delaySpread: 210,
      size: 58
    });
    addRingShockwave(append, {
      name: 'ringShockwave',
      originX: 18,
      originY: 38,
      count: 1,
      delay: 320,
      size: 44
    });
    addRingShockwave(append, {
      name: 'ringShockwave',
      originX: 82,
      originY: 36,
      count: 1,
      delay: 440,
      size: 44
    });
    addBurst(append, {
      name: 'finalePop',
      originX: 50,
      originY: 28,
      count: 32,
      minDistance: 80,
      maxDistance: 210,
      minSize: 9,
      maxSize: 18,
      delay: 2350,
      delaySpread: 220,
      minDuration: 900,
      maxDuration: 1350,
      trailEvery: 2
    });

    return fragment;
  }

  function addBurst(append, preset) {
    for (let index = 0; index < preset.count; index += 1) {
      const angle = (Math.PI * 2 * index) / preset.count + randomBetween(-0.09, 0.09);
      const distance = randomBetween(preset.minDistance, preset.maxDistance);
      const particle = document.createElement('span');
      const isTrail = preset.trailEvery && index % preset.trailEvery === 0;
      particle.className = `student-firework-particle ${isTrail ? 'is-trail' : 'is-spark'}`;
      particle.dataset.burst = preset.name;
      setFireworkVars(particle, {
        '--origin-x': `${preset.originX}%`,
        '--origin-y': `${preset.originY}%`,
        '--spark-x': `${Math.cos(angle) * distance}px`,
        '--spark-y': `${Math.sin(angle) * distance}px`,
        '--spark-size': `${randomBetween(preset.minSize, preset.maxSize).toFixed(1)}px`,
        '--spark-color': pickFireworkColor(index),
        '--spark-delay': `${Math.round(preset.delay + randomBetween(0, preset.delaySpread || 0))}ms`,
        '--spark-duration': `${Math.round(randomBetween(preset.minDuration, preset.maxDuration))}ms`,
        '--spark-rotate': `${Math.round((angle * 180) / Math.PI + 90)}deg`,
        '--spark-scale': randomBetween(0.9, 1.65).toFixed(2)
      });
      append(particle);
    }
  }

  function addSparkleRain(append, preset) {
    for (let index = 0; index < preset.count; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'student-firework-particle is-glitter';
      particle.dataset.burst = preset.name;
      setFireworkVars(particle, {
        '--origin-x': `${randomBetween(8, 92).toFixed(1)}%`,
        '--origin-y': `${randomBetween(4, 22).toFixed(1)}%`,
        '--spark-x': `${randomBetween(-46, 46).toFixed(1)}px`,
        '--spark-y': `${randomBetween(170, 330).toFixed(1)}px`,
        '--spark-size': `${randomBetween(4, 9).toFixed(1)}px`,
        '--spark-color': pickFireworkColor(index + 3),
        '--spark-delay': `${Math.round(preset.delay + randomBetween(0, preset.delaySpread || 0))}ms`,
        '--spark-duration': `${Math.round(randomBetween(1350, 2200))}ms`,
        '--spark-rotate': `${Math.round(randomBetween(150, 520))}deg`
      });
      append(particle);
    }
  }

  function addRingShockwave(append, preset) {
    for (let index = 0; index < preset.count; index += 1) {
      const ring = document.createElement('span');
      ring.className = 'student-firework-ring';
      ring.dataset.burst = preset.name;
      setFireworkVars(ring, {
        '--origin-x': `${preset.originX}%`,
        '--origin-y': `${preset.originY}%`,
        '--ring-size': `${preset.size + index * 22}px`,
        '--ring-scale': randomBetween(2.6, 4.4).toFixed(2),
        '--spark-color': pickFireworkColor(index + 1),
        '--spark-delay': `${Math.round((preset.delay || 0) + randomBetween(0, preset.delaySpread || 0))}ms`,
        '--spark-duration': `${Math.round(randomBetween(900, 1450))}ms`
      });
      append(ring);
    }
  }

  function setFireworkVars(element, vars) {
    Object.entries(vars).forEach(([name, value]) => {
      element.style.setProperty(name, value);
    });
  }

  function pickFireworkColor(offset = 0) {
    return FIREWORK_COLORS[(offset + Math.floor(Math.random() * FIREWORK_COLORS.length)) % FIREWORK_COLORS.length];
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function handleAskHighlightClick() {
    const selectedText = getHighlightedText();
    if (!selectedText) {
      showTeacherToolsWarning('Highlight part of the conversation first.');
      return;
    }

    const cappedText = selectedText.length > 300 ? `${selectedText.slice(0, 297)}...` : selectedText;
    input.value = `About this: "${cappedText}"`;
    input.focus();
  }

  function getHighlightedText() {
    const selection = window.getSelection();
    const text = String(selection?.toString() || '').replace(/\s+/g, ' ').trim();
    if (!text || !selection?.rangeCount) return '';

    const range = selection.getRangeAt(0);
    if (!selectionTouchesStudentAnswerArea(range)) return '';
    return text;
  }

  function installClassroomFrictionHandlers() {
    // This is classroom friction only. It guides behavior on the student page, but a determined user can bypass it.
    document.addEventListener('copy', (event) => {
      if (!controls.studentCopyInspectLockEnabled) return;
      const selection = window.getSelection();
      if (!selection?.rangeCount || !selectionTouchesStudentAnswerArea(selection.getRangeAt(0))) return;

      event.preventDefault();
      showTeacherToolsWarning('Use highlighted text as a reference instead of copying.');
    });

    document.addEventListener('contextmenu', (event) => {
      if (!controls.studentCopyInspectLockEnabled) return;
      event.preventDefault();
      showTeacherToolsWarning('Teacher tools are locked on this page.');
    });

    document.addEventListener('keydown', (event) => {
      if (!controls.studentCopyInspectLockEnabled) return;
      if (!isInspectShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();
      showTeacherToolsWarning('Teacher tools are locked on this page.');
    }, true);

    devtoolsTimer = window.setInterval(() => {
      if (!controls.studentCopyInspectLockEnabled) return;
      const widthGap = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0));
      const heightGap = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0));
      if (widthGap > 160 || heightGap > 160) {
        showTeacherToolsWarning('Teacher tools are locked on this page.');
      }
    }, 2000);
  }

  function selectionTouchesStudentAnswerArea(range) {
    return Boolean(timeline && range.intersectsNode(timeline));
  }

  function isInspectShortcut(event) {
    const key = String(event.key || '').toLowerCase();
    if (key === 'f12') return true;

    const ctrlShift = event.ctrlKey && event.shiftKey;
    const cmdOption = event.metaKey && event.altKey;
    return (ctrlShift || cmdOption) && ['i', 'j', 'c'].includes(key);
  }

  function showTeacherToolsWarning(message = 'Teacher tools are locked on this page.') {
    if (!frictionWarning) return;

    frictionWarning.textContent = message;
    frictionWarning.hidden = false;
    window.clearTimeout(warningTimer);
    warningTimer = window.setTimeout(() => {
      frictionWarning.hidden = true;
    }, 3000);
  }

  function friendlyStudentError(message) {
    if (/slow down|rate/i.test(message)) {
      return 'Slow down a little. Try reading the last answer before asking another question.';
    }

    return message;
  }

  function flashPointButton() {
    if (!pointButton) return;

    pointButton.classList.remove('is-flashing');
    void pointButton.offsetWidth;
    pointButton.classList.add('is-flashing');
    window.setTimeout(() => {
      pointButton.classList.remove('is-flashing');
    }, 660);
  }

  function playPointClick() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, now);
      oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.055);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.075);
      oscillator.addEventListener('ended', () => audioContext.close().catch(() => {}));
    } catch {
      // Browser audio policies can block this; the button still works without sound.
    }
  }

  function getOrCreateStudentHubId() {
    try {
      const existingId = window.localStorage.getItem(STUDENT_HUB_STORAGE_KEY);
      if (existingId) return existingId;

      const nextId = createStudentHubId();
      window.localStorage.setItem(STUDENT_HUB_STORAGE_KEY, nextId);
      return nextId;
    } catch {
      return createStudentHubId();
    }
  }

  function createStudentHubId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `hub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizePositiveInteger(value, fallback) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) return Number(fallback) || 1;
    return number;
  }

  function normalizeNonNegativeInteger(value, fallback) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0) return Math.max(0, Number(fallback) || 0);
    return number;
  }

  function normalizePositiveNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return Number(fallback) || 1;
    return number;
  }

  function normalizeNonNegativeNumber(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return Math.max(0, Number(fallback) || 0);
    return number;
  }

  function toTitleCase(value) {
    return String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(' ');
  }

  function normalizeTutorSessionPart(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
