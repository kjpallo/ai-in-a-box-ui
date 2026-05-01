(function () {
  let initialized = false;
  let currentDate = '';
  let currentProfileStatus = null;
  let currentStudentUrl = '';

  function byId(id) {
    return document.getElementById(id);
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
    return escapeHtml(value).replaceAll('`', '&#096;');
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    if (!response.ok) {
      let message = 'HTTP ' + response.status;
      try {
        const data = await response.json();
        message = data.error || data.message || message;
      } catch {
        // Use the HTTP status when the response is not JSON.
      }
      throw new Error(message);
    }
    return response.json();
  }

  async function loadProfileStatus() {
    try {
      const data = await fetchJson('/api/profile/status');
      renderProfileStatus(data);
    } catch (error) {
      renderProfileStatus({
        googleConnected: false,
        gmailConnected: false,
        teacher: null,
        message: 'Could not load profile status.'
      });
    }
  }

  function renderProfileStatus(data) {
    currentProfileStatus = data || null;
    const teacher = data && data.teacher && typeof data.teacher === 'object' ? data.teacher : null;
    const hasRealTeacher = Boolean(teacher && (teacher.email || teacher.firstName || teacher.lastName));
    const googleConfigured = Boolean(data && data.googleConfigured);
    const gmailConnected = Boolean(data && data.gmailConnected);

    setText('profileConnectionMessage', data?.message || 'Google sign-in is not connected yet.');
    setText('profileStatusPill', hasRealTeacher ? 'Signed in' : 'Not signed in');
    setText(
      'profileHelpText',
      hasRealTeacher
        ? 'Teacher profile information is loaded from the local profile API.'
        : 'Connect Gmail to show teacher profile information.'
    );
    setText('profileEmail', hasRealTeacher ? teacher.email || 'Not available' : 'Not signed in');
    setText('profileFirstName', hasRealTeacher ? teacher.firstName || 'Not available' : 'Not available');
    setText('profileLastName', hasRealTeacher ? teacher.lastName || 'Not available' : 'Not available');
    setText('profileAvatar', hasRealTeacher ? initialsForTeacher(teacher) : 'TP');
    setText(
      'profileEmailNotice',
      gmailConnected ? 'Gmail is connected for future daily reports.' : 'Connect Gmail before sending daily reports.'
    );

    const emailButton = byId('profileSendDailyEmail');
    if (emailButton) emailButton.disabled = !gmailConnected;

    const connectButton = byId('profileConnectGoogleButton');
    if (connectButton) {
      connectButton.disabled = !googleConfigured;
      connectButton.textContent = gmailConnected ? 'Reconnect Gmail' : 'Connect Gmail';
      connectButton.title = googleConfigured
        ? 'Connect this local app to a teacher Gmail account.'
        : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the app.';
    }
  }

  async function loadDates(preferredDate = '') {
    const select = byId('profileDateSelect');
    if (!select) return;

    setText('profileDateStatus', 'Loading activity dates...');

    try {
      const data = await fetchJson('/api/profile/dates');
      const dates = Array.isArray(data.dates) ? data.dates.filter(Boolean) : [];
      const selectedDate = preferredDate || select.value || currentDate || data.defaultDate || todayKey();
      currentDate = dates.includes(selectedDate) ? selectedDate : dates[0] || data.defaultDate || selectedDate;

      select.innerHTML = dates.length
        ? dates.map((date) => `<option value="${escapeAttr(date)}">${escapeHtml(date)}</option>`).join('')
        : `<option value="${escapeAttr(currentDate)}">${escapeHtml(currentDate)}</option>`;
      select.value = currentDate;
      select.disabled = false;

      setText(
        'profileDateStatus',
        dates.length ? `${dates.length} activity date${dates.length === 1 ? '' : 's'} loaded.` : 'No activity dates loaded yet.'
      );

      await loadSummary(currentDate);
    } catch (error) {
      currentDate = todayKey();
      select.innerHTML = `<option value="${escapeAttr(currentDate)}">${escapeHtml(currentDate)}</option>`;
      select.value = currentDate;
      select.disabled = false;
      setText('profileDateStatus', 'Could not load activity dates.');
      renderSummaryError('Could not load daily question summary.');
    }
  }

  async function loadSummary(date) {
    const selectedDate = date || currentDate || todayKey();
    currentDate = selectedDate;
    setText('profileSummaryStatus', 'Loading question activity...');

    try {
      const data = await fetchJson('/api/profile/question-summary?date=' + encodeURIComponent(selectedDate));
      renderSummary(data);
    } catch (error) {
      renderSummaryError('Could not load daily question summary.');
    }
  }

  function renderSummary(data) {
    const total = Number(data?.totalQuestions || 0);
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    const topics = Array.isArray(data?.topics) ? data.topics : [];

    setText('profileTotalQuestions', `${total} question${total === 1 ? '' : 's'}`);
    setText(
      'profileSummaryStatus',
      total ? `Showing activity for ${data.date || currentDate}.` : 'No question activity loaded yet.'
    );

    renderQuestionRows(questions);
    renderTopicSummary(topics);
  }

  function renderSummaryError(message) {
    setText('profileTotalQuestions', '0 questions');
    setText('profileSummaryStatus', message);
    renderQuestionRows([]);
    renderTopicSummary([]);
  }

  function renderQuestionRows(questions) {
    const rows = byId('profileQuestionRows');
    if (!rows) return;

    if (!questions.length) {
      rows.innerHTML = '<p class="profile-empty-state" role="row">No question activity loaded yet.</p>';
      return;
    }

    rows.innerHTML = questions.map((item) => `
      <div class="profile-table-row" role="row">
        <span role="cell">${escapeHtml(item.time || '')}</span>
        <span role="cell">${escapeHtml(item.topic || 'other')}</span>
        <span role="cell" title="${escapeAttr(item.question || '')}">${escapeHtml(truncate(item.question, 160))}</span>
        <span role="cell" title="${escapeAttr(item.responsePreview || '')}">${escapeHtml(truncate(item.responsePreview, 160))}</span>
        <span role="cell">${escapeHtml(item.routeType || 'unknown')}</span>
        <span role="cell">${escapeHtml(item.confidence || 'unknown')}</span>
      </div>
    `).join('');
  }

  function renderTopicSummary(topics) {
    const summary = byId('profileTopicSummary');
    if (!summary) return;

    if (!topics.length) {
      summary.className = 'topic-summary-placeholder';
      summary.innerHTML = `
        <span class="topic-ring-placeholder" aria-hidden="true"></span>
        <p>Topic summary will appear here after question activity is available.</p>
      `;
      return;
    }

    summary.className = 'topic-summary-list';
    summary.innerHTML = topics.map((item) => {
      const percent = Number(item.percent || 0);
      const width = Math.max(0, Math.min(100, percent));

      return `
        <div class="profile-topic-row">
          <div class="profile-topic-copy">
            <strong>${escapeHtml(item.topic || 'other')}</strong>
            <span>${Number(item.count || 0)} question${Number(item.count || 0) === 1 ? '' : 's'} - ${escapeHtml(formatPercent(percent))}</span>
          </div>
          <div class="profile-topic-bar" aria-hidden="true">
            <span style="width: ${width}%"></span>
          </div>
        </div>
      `;
    }).join('');
  }

  function bindEvents() {
    byId('profileDateSelect')?.addEventListener('change', (event) => {
      loadSummary(event.target.value);
    });

    byId('profileRefreshSummary')?.addEventListener('click', () => {
      loadProfileStatus();
      loadDates(byId('profileDateSelect')?.value || currentDate);
      loadStudentSessions();
    });

    byId('profileConnectGoogleButton')?.addEventListener('click', () => {
      if (!currentProfileStatus?.googleConfigured) {
        setText('profileConnectionMessage', 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the app.');
        return;
      }

      window.location.href = currentProfileStatus.connectUrl || '/api/profile/google/start';
    });

    byId('profileSendDailyEmail')?.addEventListener('click', async () => {
      const emailButton = byId('profileSendDailyEmail');
      if (!currentProfileStatus?.gmailConnected) {
        setText('profileEmailNotice', 'Connect Gmail before sending daily reports.');
        return;
      }

      try {
        if (emailButton) emailButton.disabled = true;
        setText('profileEmailNotice', 'Sending daily summary email...');
        const result = await fetchJson('/api/profile/send-daily-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ date: currentDate || todayKey() })
        });
        setText('profileEmailNotice', `Daily summary email sent to ${result.to || 'your Gmail account'}.`);
      } catch (error) {
        setText('profileEmailNotice', error.message || 'Could not send the daily summary email.');
      } finally {
        if (emailButton) emailButton.disabled = !currentProfileStatus?.gmailConnected;
      }
    });

    byId('profileCreateStudentLink')?.addEventListener('click', async () => {
      const button = byId('profileCreateStudentLink');
      try {
        if (button) button.disabled = true;
        setText('profileStudentLinkStatus', 'Creating student link...');
        const result = await fetchJson('/api/profile/create-student-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        renderStudentLink(result.studentUrl || '');
        await loadStudentSessions();
      } catch (error) {
        setText('profileStudentLinkStatus', error.message || 'Could not create student link.');
      } finally {
        if (button) button.disabled = false;
      }
    });

    byId('profileCopyStudentLink')?.addEventListener('click', async () => {
      if (!currentStudentUrl) return;

      try {
        await copyText(currentStudentUrl);
        setText('profileStudentLinkStatus', 'Student link copied.');
      } catch {
        setText('profileStudentLinkStatus', 'Could not copy student link.');
      }
    });

    byId('profileStudentSessions')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-copy-student-url]');
      if (!button) return;

      const studentUrl = button.getAttribute('data-copy-student-url') || '';
      if (!studentUrl) return;

      try {
        button.disabled = true;
        await copyText(studentUrl);
        setText('profileStudentLinkStatus', 'Student link copied.');
      } catch {
        setText('profileStudentLinkStatus', 'Could not copy student link.');
      } finally {
        button.disabled = false;
      }
    });
  }

  async function init() {
    if (initialized) return;
    if (!byId('profileDateSelect') || !byId('profileRefreshSummary')) return;

    initialized = true;
    bindEvents();
    await loadProfileStatus();
    await loadDates();
    await loadStudentSessions();
  }

  async function refreshActiveProfileBlade() {
    if (!initialized || !byId('profileDateSelect')) return;
    await loadDates(byId('profileDateSelect')?.value || currentDate);
    await loadStudentSessions();
  }

  function setText(id, text) {
    const element = byId(id);
    if (element) element.textContent = String(text);
  }

  function renderStudentLink(studentUrl) {
    currentStudentUrl = studentUrl;
    const panel = byId('profileStudentLinkPanel');
    const link = byId('profileStudentUrl');

    if (panel) panel.hidden = !studentUrl;
    if (link) {
      link.textContent = studentUrl || '';
      link.href = studentUrl || '#';
    }

    setText(
      'profileStudentLinkStatus',
      studentUrl ? 'Student link ready for local classroom use.' : 'No student link created yet.'
    );
  }

  async function loadStudentSessions() {
    if (!byId('profileStudentSessions')) return;

    try {
      const data = await fetchJson('/api/profile/student-sessions');
      renderStudentSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      renderStudentSessions([], 'Could not load active student sessions.');
    }
  }

  function renderStudentSessions(sessions, errorMessage = '') {
    const rows = byId('profileStudentSessions');
    if (!rows) return;

    setText('profileStudentSessionCount', `${sessions.length} active`);

    if (errorMessage) {
      rows.innerHTML = `<p class="profile-empty-state">${escapeHtml(errorMessage)}</p>`;
      return;
    }

    if (!sessions.length) {
      rows.innerHTML = '<p class="profile-empty-state">No active student sessions yet.</p>';
      return;
    }

    rows.innerHTML = sessions.map((session) => `
      <div class="profile-student-session-row">
        <div>
          <strong>${escapeHtml(session.className || 'Class session')}</strong>
          <span>${escapeHtml(session.sessionId || '')}</span>
        </div>
        <time datetime="${escapeAttr(session.createdAt || '')}">${escapeHtml(formatSessionTime(session.createdAt))}</time>
        <a href="${escapeAttr(session.studentUrl || '#')}" target="_blank" rel="noreferrer">${escapeHtml(session.studentUrl || '')}</a>
        <button
          type="button"
          class="small-button secondary-small"
          data-copy-student-url="${escapeAttr(session.studentUrl || '')}"
        >Copy</button>
      </div>
    `).join('');
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  function initialsForTeacher(teacher) {
    const first = String(teacher.firstName || '').trim()[0] || '';
    const last = String(teacher.lastName || '').trim()[0] || '';
    const email = String(teacher.email || '').trim()[0] || 'T';
    return (first + last || email).toUpperCase();
  }

  function truncate(value, limit) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    return text.slice(0, limit - 3) + '...';
  }

  function formatPercent(value) {
    return `${Math.round(value * 10) / 10}%`;
  }

  function formatSessionTime(value) {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function todayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('charlemagne:blade-active', (event) => {
    if (event.detail?.id === 'modes') {
      refreshActiveProfileBlade();
    }
  });
  setTimeout(init, 250);
  setTimeout(init, 1000);

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
