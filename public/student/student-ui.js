(() => {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId') || '';
  const form = document.getElementById('studentMessageForm');
  const input = document.getElementById('studentMessageInput');
  const sendButton = document.getElementById('studentSendButton');
  const pointButton = document.getElementById('studentPointButton');
  const responseBox = document.getElementById('studentResponse');
  const sessionText = document.getElementById('sessionIdText');
  const status = document.getElementById('studentStatus');
  const routeInfo = document.getElementById('studentRouteInfo');
  const sessionMessage = document.getElementById('studentSessionMessage');
  const historyBox = document.getElementById('studentHistory');
  const historyCount = document.getElementById('studentHistoryCount');
  const chatHistory = [];
  let sessionIsValid = false;

  function init() {
    if (!form || !input || !sendButton) return;

    sessionText.textContent = sessionId || 'Missing session';
    setFormEnabled(false);
    validateSession();

    form.addEventListener('submit', handleSubmit);
    pointButton?.addEventListener('click', handlePointClick);
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
      const data = await window.Charlemagne.api.sendStudentMessage(sessionId, message);
      responseBox.textContent = data.response || 'No response returned.';
      routeInfo.textContent = `${data.routeType || 'unknown'} / ${data.confidence || 'unknown'}`;
      status.textContent = 'Ready';
      addHistoryItem(message, data.response || 'No response returned.');
      input.value = '';
    } catch (error) {
      responseBox.textContent = error.message || 'Could not send message.';
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
      const data = await window.Charlemagne.api.sendStudentWhyThisMatters(sessionId);
      responseBox.textContent = data.response || 'No response returned.';
      routeInfo.textContent = `${data.routeType || 'unknown'} / ${data.confidence || 'unknown'}`;
      status.textContent = 'Ready';
      addHistoryItem("What's the point?", data.response || 'No response returned.');
    } catch (error) {
      responseBox.textContent = error.message || 'Could not send message.';
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
      const data = await window.Charlemagne.api.fetchStudentSessions();
      const sessions = Array.isArray(data.sessions) ? data.sessions : [];
      const session = sessions.find((item) => item.sessionId === sessionId);

      if (!session) {
        showInvalidSession('This student session is not active. Ask your teacher for a new link.');
        return;
      }

      sessionIsValid = true;
      sessionText.textContent = sessionId;
      sessionMessage.textContent = 'Connected to session.';
      status.textContent = 'Connected';
      responseBox.textContent = 'Ask a question to see the response here.';
      setFormEnabled(true);
      input.focus();
    } catch (error) {
      if ((error.message || '') === 'Teacher login required.') {
        sessionIsValid = true;
        sessionText.textContent = sessionId;
        sessionMessage.textContent = 'Connected to classroom link.';
        status.textContent = 'Connected';
        responseBox.textContent = 'Ask a question to see the response here.';
        setFormEnabled(true);
        input.focus();
        return;
      }

      showInvalidSession(error.message || 'Could not check this student session.');
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
