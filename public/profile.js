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
    return window.Charlemagne.api.fetchJson(url, options);
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

  async function loadStandardsSummaryReport() {
    const refreshButton = byId('profileRefreshStandardsReport');
    if (!byId('standardsSummaryRows')) return;

    setText('standardsSummaryStatus', 'Loading standards report...');
    if (refreshButton) refreshButton.disabled = true;

    try {
      const data = await fetchJson('/api/profile/standards-summary');
      if (data?.ok === false) {
        renderStandardsSummaryError(data.error || 'Could not load standards summary report.');
        return;
      }

      renderStandardsSummaryReport(data?.summary);
    } catch (error) {
      renderStandardsSummaryError(error.message || 'Could not load standards summary report.');
    } finally {
      if (refreshButton) refreshButton.disabled = false;
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

  function renderStandardsSummaryReport(summary) {
    const safeSummary = normalizeStandardsSummary(summary);
    const total = safeSummary.totalQuestions;
    const tagged = safeSummary.taggedQuestions;
    const generatedLabel = formatDateTime(safeSummary.generatedAt);

    setText('standardsTotalQuestions', total);
    setText('standardsTaggedQuestions', tagged);
    setText('standardsUntaggedQuestions', safeSummary.untaggedQuestions);
    setText('standardsGeneratedAt', generatedLabel);
    setText('standardsConfidenceStrong', safeSummary.standardsConfidence.strong);
    setText('standardsConfidenceMedium', safeSummary.standardsConfidence.medium);
    setText('standardsConfidenceWeak', safeSummary.standardsConfidence.weak);
    setText('standardsConfidenceNone', safeSummary.standardsConfidence.none);
    setText(
      'standardsSummaryStatus',
      generatedLabel === 'Not available' ? 'Standards report loaded.' : `Generated ${generatedLabel}.`
    );

    renderStandardsReportEmptyState(safeSummary);
    renderStandardsRows(safeSummary.standards);
    renderConceptRows(safeSummary.concepts);
    renderUnitRows(safeSummary.units);
    renderRouteRows(safeSummary.routeTypes);
    renderRecentTaggedQuestions(safeSummary.recentTaggedQuestions);
  }

  function renderStandardsSummaryError(message) {
    const emptySummary = normalizeStandardsSummary({});
    setText('standardsTotalQuestions', 0);
    setText('standardsTaggedQuestions', 0);
    setText('standardsUntaggedQuestions', 0);
    setText('standardsGeneratedAt', 'Not loaded');
    setText('standardsConfidenceStrong', 0);
    setText('standardsConfidenceMedium', 0);
    setText('standardsConfidenceWeak', 0);
    setText('standardsConfidenceNone', 0);
    setText('standardsSummaryStatus', message);
    renderStandardsReportEmptyState(emptySummary, message);
    renderStandardsRows([]);
    renderConceptRows([]);
    renderUnitRows([]);
    renderRouteRows([]);
    renderRecentTaggedQuestions([]);
  }

  function renderStandardsReportEmptyState(summary, errorMessage = '') {
    const state = byId('standardsSummaryEmptyState');
    if (!state) return;

    let message = '';
    if (errorMessage) {
      message = errorMessage;
    } else if (summary.totalQuestions === 0) {
      message = 'No student questions have been logged yet.';
    } else if (summary.taggedQuestions === 0) {
      message = 'Questions have been logged, but no standards/concept tags were found yet.';
    }

    state.hidden = !message;
    state.textContent = message;
  }

  function renderStandardsRows(standards) {
    const rows = byId('standardsSummaryRows');
    if (!rows) return;

    if (!standards.length) {
      rows.innerHTML = '<p class="profile-empty-state" role="row">No standards matched yet.</p>';
      return;
    }

    rows.innerHTML = standards.map((item) => `
      <div class="standards-report-row standards-table-row" role="row">
        <span role="cell">${escapeHtml(item.standardId || 'Unknown')}</span>
        <span role="cell" title="${escapeAttr(item.label || '')}">${escapeHtml(truncate(item.label || 'No label', 120))}</span>
        <span role="cell">${escapeHtml(item.unit || 'Unknown')}</span>
        <span role="cell">${escapeHtml(formatNumber(item.count))}</span>
        <span role="cell">${escapeHtml(formatCountMap(item.routeTypes))}</span>
        <span role="cell">${escapeHtml(formatConfidenceCounts(item.standardsConfidence))}</span>
        <div role="cell">${renderExampleQuestions(item.exampleQuestions)}</div>
      </div>
    `).join('');
  }

  function renderConceptRows(concepts) {
    const rows = byId('standardsConceptRows');
    if (!rows) return;

    if (!concepts.length) {
      rows.innerHTML = '<p class="profile-empty-state" role="row">No concepts matched yet.</p>';
      return;
    }

    rows.innerHTML = concepts.map((item) => `
      <div class="standards-report-row concepts-table-row" role="row">
        <span role="cell">${escapeHtml(item.title || item.id || 'Unknown')}</span>
        <span role="cell">${escapeHtml(item.type || 'Unknown')}</span>
        <span role="cell">${escapeHtml(item.unit || 'Unknown')}</span>
        <span role="cell">${escapeHtml(formatNumber(item.count))}</span>
        <span role="cell">${escapeHtml(formatNumber(item.averageScore))}</span>
        <div role="cell">${renderExampleQuestions(item.exampleQuestions)}</div>
      </div>
    `).join('');
  }

  function renderUnitRows(units) {
    const rows = byId('standardsUnitRows');
    if (!rows) return;

    if (!units.length) {
      rows.innerHTML = '<p class="profile-empty-state" role="row">No units matched yet.</p>';
      return;
    }

    rows.innerHTML = units.map((item) => `
      <div class="standards-report-row units-table-row" role="row">
        <span role="cell">${escapeHtml(item.unit || 'Unknown')}</span>
        <span role="cell">${escapeHtml(formatNumber(item.count))}</span>
        <span role="cell">${escapeHtml(formatNumber(item.standardsCount))}</span>
        <span role="cell">${escapeHtml(formatNumber(item.conceptsCount))}</span>
        <div role="cell">${renderExampleQuestions(item.exampleQuestions)}</div>
      </div>
    `).join('');
  }

  function renderRouteRows(routeTypes) {
    const rows = byId('standardsRouteRows');
    if (!rows) return;

    if (!routeTypes.length) {
      rows.innerHTML = '<p class="profile-empty-state">No route types logged yet.</p>';
      return;
    }

    rows.innerHTML = routeTypes.map((item) => `
      <div>
        <span>${escapeHtml(item.routeType || 'unknown')}</span>
        <strong>${escapeHtml(formatNumber(item.count))}</strong>
      </div>
    `).join('');
  }

  function renderRecentTaggedQuestions(rowsData) {
    const rows = byId('standardsRecentRows');
    if (!rows) return;

    if (!rowsData.length) {
      rows.innerHTML = '<p class="profile-empty-state" role="row">No recent tagged questions yet.</p>';
      return;
    }

    rows.innerHTML = rowsData.map((item) => `
      <div class="standards-report-row recent-standards-row" role="row">
        <span role="cell">${escapeHtml(formatDateTime(item.timestamp))}</span>
        <span role="cell" title="${escapeAttr(item.question || '')}">${escapeHtml(truncate(item.question || 'No question text', 140))}</span>
        <span role="cell">${escapeHtml(item.routeType || 'unknown')}</span>
        <span role="cell">${escapeHtml(item.standardsConfidence || 'none')}</span>
        <span role="cell">${escapeHtml(formatTextList(item.units))}</span>
        <span role="cell">${escapeHtml(formatStandardsList(item.standards))}</span>
        <span role="cell">${escapeHtml(formatConceptsList(item.concepts))}</span>
      </div>
    `).join('');
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
      loadStandardsSummaryReport();
    });

    byId('profileRefreshStandardsReport')?.addEventListener('click', () => {
      loadStandardsSummaryReport();
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
    await loadStandardsSummaryReport();
  }

  async function refreshActiveProfileBlade() {
    if (!initialized || !byId('profileDateSelect')) return;
    await loadDates(byId('profileDateSelect')?.value || currentDate);
    await loadStudentSessions();
    await loadStandardsSummaryReport();
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

  function normalizeStandardsSummary(summary) {
    const confidence = summary?.standardsConfidence && typeof summary.standardsConfidence === 'object'
      ? summary.standardsConfidence
      : {};
    const totalQuestions = toCount(summary?.totalQuestions);
    const taggedQuestions = toCount(summary?.taggedQuestions);

    return {
      generatedAt: summary?.generatedAt || '',
      totalQuestions,
      taggedQuestions,
      untaggedQuestions: Number.isFinite(Number(summary?.untaggedQuestions))
        ? toCount(summary.untaggedQuestions)
        : Math.max(0, totalQuestions - taggedQuestions),
      standards: objectRows(summary?.standards),
      concepts: objectRows(summary?.concepts),
      units: objectRows(summary?.units),
      routeTypes: objectRows(summary?.routeTypes),
      standardsConfidence: {
        strong: toCount(confidence.strong),
        medium: toCount(confidence.medium),
        weak: toCount(confidence.weak),
        none: toCount(confidence.none)
      },
      recentTaggedQuestions: objectRows(summary?.recentTaggedQuestions)
    };
  }

  function objectRows(value) {
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
  }

  function renderExampleQuestions(examples) {
    const questions = Array.isArray(examples)
      ? examples.map((example) => normalizeExampleQuestion(example)).filter(Boolean).slice(0, 3)
      : [];

    if (!questions.length) return '<span class="standards-muted">No examples</span>';

    return `
      <ul class="standards-example-list">
        ${questions.map((question) => `<li>${escapeHtml(truncate(question, 90))}</li>`).join('')}
      </ul>
    `;
  }

  function normalizeExampleQuestion(example) {
    if (typeof example === 'string') return example.trim();
    if (example && typeof example === 'object') return String(example.question || '').trim();
    return '';
  }

  function formatTextList(values) {
    if (!Array.isArray(values)) return 'None';
    const labels = values.map((value) => String(value || '').trim()).filter(Boolean);
    return labels.length ? labels.join(', ') : 'None';
  }

  function formatStandardsList(values) {
    if (!Array.isArray(values)) return 'None';
    const labels = values
      .map((item) => item && typeof item === 'object' ? item.standardId || item.label : item)
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return labels.length ? labels.join(', ') : 'None';
  }

  function formatConceptsList(values) {
    if (!Array.isArray(values)) return 'None';
    const labels = values
      .map((item) => item && typeof item === 'object' ? item.title || item.id : item)
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return labels.length ? labels.join(', ') : 'None';
  }

  function formatCountMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return 'None';
    const parts = Object.entries(value)
      .filter(([, count]) => Number(count) > 0)
      .map(([label, count]) => `${label}: ${formatNumber(count)}`);
    return parts.length ? parts.join(', ') : 'None';
  }

  function formatConfidenceCounts(value) {
    const counts = value && typeof value === 'object' ? value : {};
    return `S ${toCount(counts.strong)} / M ${toCount(counts.medium)} / W ${toCount(counts.weak)} / N ${toCount(counts.none)}`;
  }

  function formatDateTime(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '0';
    return String(Math.round(number * 10) / 10);
  }

  function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
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
