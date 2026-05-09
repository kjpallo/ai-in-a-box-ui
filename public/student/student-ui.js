(() => {
  const STUDENT_HUB_STORAGE_KEY = 'charlemagne.anonymousStudentHubId';
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId') || params.get('classSessionId') || '';
  const studentHubId = getOrCreateStudentHubId();
  const form = document.getElementById('studentMessageForm');
  const input = document.getElementById('studentMessageInput');
  const sendButton = document.getElementById('studentSendButton');
  const pointButton = document.getElementById('studentPointButton');
  const askHighlightButton = document.getElementById('studentAskHighlightButton');
  const responseBox = document.getElementById('studentResponse');
  const sessionText = document.getElementById('sessionIdText');
  const status = document.getElementById('studentStatus');
  const routeInfo = document.getElementById('studentRouteInfo');
  const copyAnswerButton = document.getElementById('studentCopyAnswerButton');
  const clearButton = document.getElementById('studentClearButton');
  const tutorCard = document.getElementById('studentTutorCard');
  const tutorTitle = document.getElementById('studentTutorTitle');
  const tutorProgress = document.getElementById('studentTutorProgress');
  const tutorSolveFor = document.getElementById('studentTutorSolveFor');
  const tutorFormula = document.getElementById('studentTutorFormula');
  const tutorKnownValues = document.getElementById('studentTutorKnownValues');
  const tutorPrompt = document.getElementById('studentTutorPrompt');
  const tutorHintWrap = document.getElementById('studentTutorHintWrap');
  const tutorHint = document.getElementById('studentTutorHint');
  const tutorFinalWrap = document.getElementById('studentTutorFinalWrap');
  const tutorFinal = document.getElementById('studentTutorFinal');
  const sessionMessage = document.getElementById('studentSessionMessage');
  const historyBox = document.getElementById('studentHistory');
  const historyCount = document.getElementById('studentHistoryCount');
  const frictionWarning = document.getElementById('studentFrictionWarning');
  const energyPanel = document.getElementById('studentQuestionEnergy');
  const energyValue = document.getElementById('studentQuestionEnergyValue');
  const energyHelper = document.getElementById('studentQuestionEnergyHelper');
  const energyFill = document.getElementById('studentQuestionEnergyFill');
  const chatHistory = [];
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

  async function init() {
    if (!form || !input || !sendButton) return;

    sessionText.textContent = sessionId || 'Missing session';
    setFormEnabled(false);
    await loadStudentControls();
    renderRateLimitEnergy();
    await validateSession();

    form.addEventListener('submit', handleSubmit);
    pointButton?.addEventListener('click', handlePointClick);
    askHighlightButton?.addEventListener('click', handleAskHighlightClick);
    copyAnswerButton?.addEventListener('click', handleCopyAnswerClick);
    clearButton?.addEventListener('click', handleClearClick);
    tutorCard?.addEventListener('click', handleTutorCardClick);
    installClassroomFrictionHandlers();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || !sessionIsValid) return;

    setFormEnabled(false);
    status.textContent = 'Sending';
    responseBox.textContent = 'Thinking...';
    routeInfo.textContent = 'Routing';

    try {
      const data = await sendStudentMessage(message);
      renderStudentMessageResult(data, message);
      input.value = '';
    } catch (error) {
      const message = error.message || 'Could not send message.';
      updateRateLimitState(error.rateLimit);
      responseBox.textContent = friendlyStudentError(message);
      routeInfo.textContent = 'Error';
      status.textContent = 'Error';
      if (/session/i.test(error.message || '')) {
        showInvalidSession(error.message);
      }
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  async function handlePointClick() {
    if (!sessionIsValid) return;

    flashPointButton();
    playPointClick();
    setFormEnabled(false);
    status.textContent = 'Sending';
    responseBox.textContent = 'Thinking...';
    routeInfo.textContent = 'Routing';

    try {
      const data = await window.Charlemagne.api.sendStudentWhyThisMatters(sessionId, studentHubId);
      renderStudentMessageResult(data, "What's the point?");
    } catch (error) {
      const message = error.message || 'Could not send message.';
      updateRateLimitState(error.rateLimit);
      responseBox.textContent = friendlyStudentError(message);
      routeInfo.textContent = 'Error';
      status.textContent = 'Error';
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
      responseBox.textContent = 'Ask a question to see the response here.';
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
      energyValue.textContent = 'Question limit: Off';
      if (energyHelper) energyHelper.textContent = '';
      energyFill.style.width = '100%';
      return;
    }

    energyValue.textContent = `${remainingWhole} / ${max} questions ready`;
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
    responseBox.textContent = message;
    setFormEnabled(false);
  }

  function setFormEnabled(enabled) {
    input.disabled = !enabled;
    sendButton.disabled = !enabled;
    if (pointButton) pointButton.disabled = !enabled;
    if (askHighlightButton) askHighlightButton.disabled = !enabled;
    if (copyAnswerButton) copyAnswerButton.disabled = !enabled;
    if (clearButton) clearButton.disabled = !enabled;
    if (tutorCard) {
      for (const button of tutorCard.querySelectorAll('[data-tutor-action]')) {
        button.disabled = !enabled;
      }
    }
  }

  async function sendStudentMessage(message) {
    return window.Charlemagne.api.sendStudentMessage(sessionId, message, studentHubId);
  }

  function renderStudentMessageResult(data, message) {
    updateRateLimitState(data.rateLimit);
    responseBox.textContent = data.response || 'No response returned.';
    routeInfo.textContent = `${data.routeType || 'unknown'} / ${data.confidence || 'unknown'}`;
    status.textContent = 'Ready';
    renderTutorCard(data.tutor);
    addHistoryItem(message, data.response || 'No response returned.');
  }

  async function handleTutorCardClick(event) {
    const button = event.target.closest('[data-tutor-action]');
    if (!button || !sessionIsValid) return;

    const command = button.getAttribute('data-tutor-action') || '';
    if (!command) return;

    setFormEnabled(false);
    status.textContent = 'Sending';
    responseBox.textContent = 'Thinking...';
    routeInfo.textContent = 'Routing';

    try {
      const data = await sendStudentMessage(command);
      renderStudentMessageResult(data, command);
    } catch (error) {
      const message = error.message || 'Could not send message.';
      updateRateLimitState(error.rateLimit);
      responseBox.textContent = friendlyStudentError(message);
      routeInfo.textContent = 'Error';
      status.textContent = 'Error';
    } finally {
      setFormEnabled(sessionIsValid);
      if (sessionIsValid) input.focus();
    }
  }

  async function handleCopyAnswerClick() {
    const text = responseBox?.textContent?.trim() || '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showTeacherToolsWarning('Answer copied.');
    } catch {
      showTeacherToolsWarning('Could not copy from this browser.');
    }
  }

  function handleClearClick() {
    responseBox.textContent = 'Ask a question to see the response here.';
    routeInfo.textContent = 'No route yet';
  }

  function renderTutorCard(tutor) {
    if (!tutorCard) return;

    if (!tutor || typeof tutor !== 'object') {
      delete tutorCard.dataset.hasTutor;
      tutorCard.hidden = true;
      tutorCard.classList.remove('is-complete', 'is-stopped');
      return;
    }

    tutorCard.dataset.hasTutor = 'true';
    tutorCard.hidden = false;
    tutorCard.classList.toggle('is-complete', tutor.completed === true);
    tutorCard.classList.toggle('is-stopped', tutor.stopped === true);

    if (tutor.stopped) {
      tutorTitle.textContent = 'Guided Tutor Stopped';
      tutorProgress.textContent = '';
      tutorSolveFor.textContent = '';
      tutorFormula.textContent = '';
      tutorKnownValues.innerHTML = '';
      tutorPrompt.textContent = 'Guided tutor stopped.';
      setTutorHint('');
      setTutorFinal('');
      return;
    }

    if (tutor.completed) {
      tutorTitle.textContent = 'Guided Formula Tutor Complete';
      tutorProgress.textContent = '';
      tutorSolveFor.textContent = tutor.solveFor || '';
      tutorFormula.textContent = tutor.formula || '';
      tutorKnownValues.innerHTML = '';
      tutorPrompt.textContent = 'Final answer unlocked.';
      setTutorHint('');
      setTutorFinal(tutor.finalAnswerDisplay || '');
      return;
    }

    const stepNumber = Number(tutor.currentStepIndex) + 1;
    const totalSteps = Number(tutor.totalSteps) || 0;
    tutorTitle.textContent = 'Guided Formula Tutor';
    tutorProgress.textContent = totalSteps > 0 ? `Step ${stepNumber} of ${totalSteps}` : '';
    tutorSolveFor.textContent = tutor.solveFor || '';
    tutorFormula.textContent = tutor.formula || '';
    tutorPrompt.textContent = tutor.currentStepPrompt || '';
    renderKnownValues(tutor.knownValues);
    setTutorHint(tutor.currentHint || '');
    setTutorFinal('');
  }

  function renderKnownValues(values) {
    if (!tutorKnownValues) return;
    const safeValues = Array.isArray(values) ? values : [];
    if (!safeValues.length) {
      tutorKnownValues.innerHTML = '<div><dt>Not filled in yet</dt><dd></dd></div>';
      return;
    }

    tutorKnownValues.innerHTML = safeValues.map((value) => {
      const label = [value.label, value.symbol ? `(${value.symbol})` : ''].filter(Boolean).join(' ');
      return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value.display || '')}</dd></div>`;
    }).join('');
  }

  function setTutorHint(value) {
    if (!tutorHintWrap || !tutorHint) return;
    const text = String(value || '').trim();
    tutorHintWrap.hidden = !text;
    tutorHint.textContent = text;
  }

  function setTutorFinal(value) {
    if (!tutorFinalWrap || !tutorFinal) return;
    const text = String(value || '').trim();
    tutorFinalWrap.hidden = !text;
    tutorFinal.textContent = text;
  }

  function handleAskHighlightClick() {
    const selectedText = getHighlightedText();
    if (!selectedText) {
      showTeacherToolsWarning('Highlight part of the answer first.');
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
    return [responseBox, historyBox].some((element) => {
      if (!element) return false;
      return range.intersectsNode(element);
    });
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

  function addHistoryItem(message, response) {
    chatHistory.push({ message, response });
    renderHistory();
  }

  function renderHistory() {
    if (!historyBox || !historyCount) return;

    const messageCount = chatHistory.length * 2;
    historyCount.textContent = `${messageCount} message${messageCount === 1 ? '' : 's'}`;
    historyBox.innerHTML = chatHistory.map((item) => `
      <article class="student-history-item">
        <div class="student-history-message is-student">
          <strong>You asked</strong>
          <p>${escapeHtml(item.message)}</p>
        </div>
        <div class="student-history-message is-assistant">
          <strong>Charlemagne answered</strong>
          <p>${escapeHtml(item.response)}</p>
        </div>
      </article>
    `).join('');
    historyBox.scrollTop = historyBox.scrollHeight;
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
