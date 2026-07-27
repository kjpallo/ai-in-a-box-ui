(() => {
  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && data.error === 'Teacher login required.' && !isStudentPage()) {
        window.location.href = '/login.html';
      }

      const errorMessage = data.error
        || data.message
        || (Array.isArray(data.errors) && data.errors.length > 0 ? data.errors.join('; ') : '')
        || data.details
        || `HTTP ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = data.code || '';
      error.details = data.details || '';
      error.errors = Array.isArray(data.errors) ? data.errors : [];
      error.timeline = Array.isArray(data.timeline) ? data.timeline : [];
      error.data = data;
      error.rateLimit = data.rateLimit || null;
      throw error;
    }

    return data;
  }

  function isStudentPage() {
    return window.location.pathname.endsWith('/student.html')
      || window.location.pathname.startsWith('/join/');
  }

  async function askQuestion(question, options = {}) {
    const message = String(question || '').trim();
    if (!message) throw new Error('Message is required.');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, voice: options.voice || '' }),
      signal: options.signal
    });

    if (!response.ok || !response.body) {
      if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'Teacher login required.' && !isStudentPage()) {
          window.location.href = '/login.html';
          throw new Error('Teacher mode is locked. Sign in to continue.');
        }
      }

      throw new Error('The classroom assistant is not connected right now. Tell your teacher.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const eventData = JSON.parse(line);
        if (typeof options.onEvent === 'function') {
          await options.onEvent(eventData);
        }
      }
    }
  }

  function fetchHealth() {
    return fetchJson('/api/health');
  }

  function fetchVoices() {
    return fetchJson('/api/voices');
  }

  function fetchSystemHealth() {
    return fetchJson('/api/system-health');
  }

  function reloadTeacherFacts() {
    return Promise.reject(new Error('Reload teacher facts is not exposed by the backend yet.'));
  }

  function fetchProfileStatus() {
    return fetchJson('/api/profile/status');
  }

  function fetchProfileDates() {
    return fetchJson('/api/profile/dates');
  }

  function fetchProfileRundown(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson(`/api/profile/question-summary${query}`);
  }

  function fetchStandardsSummary() {
    return fetchJson('/api/profile/standards-summary');
  }

  function createStudentSession() {
    return fetchJson('/api/profile/create-student-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  }

  function fetchStudentSessions() {
    return fetchJson('/api/profile/student-sessions');
  }

  function fetchStudentControls(sessionAccess = '') {
    const query = buildStudentSessionQuery(sessionAccess);
    return fetchJson(`/api/student/controls?${query.toString()}`);
  }

  function fetchStudentRateLimitStatus(sessionAccess, studentHubId = '') {
    const query = buildStudentSessionQuery(sessionAccess);
    query.set('studentHubId', String(studentHubId || ''));
    return fetchJson(`/api/student/rate-limit-status?${query.toString()}`);
  }

  function sendDailySummary(date) {
    return fetchJson('/api/profile/send-daily-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date })
    });
  }

  function sendVoiceTranscript(audioBlob) {
    return fetchJson('/api/whisper/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob?.type || 'application/octet-stream'
      },
      body: audioBlob
    });
  }

  function joinStudentSession(sessionAccess, studentHubId) {
    return fetchJson('/api/student/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildStudentSessionAccess(sessionAccess),
        studentHubId
      })
    });
  }

  function sendStudentMessage(sessionAccess, message, studentHubId = '') {
    return fetchJson('/api/student/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildStudentSessionAccess(sessionAccess),
        message,
        studentHubId
      })
    });
  }

  function sendStudentWhyThisMatters(sessionAccess, studentHubId = '') {
    return fetchJson('/api/student/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...buildStudentSessionAccess(sessionAccess),
        studentHubId,
        message: "What's the point?",
        intent: 'why_this_matters'
      })
    });
  }

  function buildStudentSessionAccess(sessionAccess) {
    const value = String(sessionAccess || '').trim();
    if (/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/i.test(value)) {
      return { joinCode: value.toUpperCase() };
    }
    return {
      sessionId: value,
      classSessionId: value
    };
  }

  function buildStudentSessionQuery(sessionAccess) {
    return new URLSearchParams(buildStudentSessionAccess(sessionAccess));
  }

  const api = {
    askQuestion,
    createStudentSession,
    fetchHealth,
    fetchJson,
    fetchProfileDates,
    fetchProfileRundown,
    fetchProfileStatus,
    fetchStandardsSummary,
    fetchStudentSessions,
    fetchStudentControls,
    fetchStudentRateLimitStatus,
    fetchSystemHealth,
    fetchVoices,
    joinStudentSession,
    reloadTeacherFacts,
    sendDailySummary,
    sendStudentMessage,
    sendStudentWhyThisMatters,
    sendVoiceTranscript
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.api = api;
})();
