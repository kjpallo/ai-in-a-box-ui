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
  const sessionMessage = document.getElementById('studentSessionMessage');
  const historyBox = document.getElementById('studentHistory');
  const historyCount = document.getElementById('studentHistoryCount');
  const frictionWarning = document.getElementById('studentFrictionWarning');
  const chatHistory = [];
  const controls = {
    studentCopyInspectLockEnabled: true,
    studentQuestionRateLimitEnabled: true,
    studentQuestionsPerMinute: 6
  };
  let sessionIsValid = false;
  let heartbeatTimer = null;
  let warningTimer = null;
  let devtoolsTimer = null;

  function init() {
    if (!form || !input || !sendButton) return;

    sessionText.textContent = sessionId || 'Missing session';
    setFormEnabled(false);
    loadStudentControls();
    validateSession();

    form.addEventListener('submit', handleSubmit);
    pointButton?.addEventListener('click', handlePointClick);
    askHighlightButton?.addEventListener('click', handleAskHighlightClick);
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
      const data = await window.Charlemagne.api.sendStudentMessage(sessionId, message, studentHubId);
      responseBox.textContent = data.response || 'No response returned.';
      routeInfo.textContent = `${data.routeType || 'unknown'} / ${data.confidence || 'unknown'}`;
      status.textContent = 'Ready';
      addHistoryItem(message, data.response || 'No response returned.');
      input.value = '';
    } catch (error) {
      const message = error.message || 'Could not send message.';
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
      responseBox.textContent = data.response || 'No response returned.';
      routeInfo.textContent = `${data.routeType || 'unknown'} / ${data.confidence || 'unknown'}`;
      status.textContent = 'Ready';
      addHistoryItem("What's the point?", data.response || 'No response returned.');
    } catch (error) {
      const message = error.message || 'Could not send message.';
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

      sessionIsValid = true;
      sessionText.textContent = sessionId;
      sessionMessage.textContent = 'Connected to session.';
      status.textContent = 'Connected';
      responseBox.textContent = 'Ask a question to see the response here.';
      setFormEnabled(true);
      startHeartbeat();
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
    } catch {
      controls.studentCopyInspectLockEnabled = true;
      controls.studentQuestionRateLimitEnabled = true;
      controls.studentQuestionsPerMinute = 6;
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
