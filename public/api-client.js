(() => {
  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
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

  function sendStudentMessage(sessionId, message) {
    return fetchJson('/api/student/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message })
    });
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
    fetchSystemHealth,
    fetchVoices,
    reloadTeacherFacts,
    sendDailySummary,
    sendStudentMessage,
    sendVoiceTranscript
  };

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.api = api;
})();
