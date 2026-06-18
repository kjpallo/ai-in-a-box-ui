(function () {
  let initialized = false;
  let currentDate = '';
  let currentProfileStatus = null;
  let currentStudentUrl = '';
  let currentStandardsTagged = 0;
  let currentStandardsSummary = null;
  let currentQuestions = [];
  let currentReportQuestions = [];
  let reportQuestionFilter = 'all';
  let questionsStandardsExportState = null;
  const restartedReportSessions = new Map();
  let availableActivityDates = [];
  const standardDetailsCache = new Map();
  let showingReviewQuestions = false;
  let studentSessionRefreshTimer = null;
  let loadingStudentControls = false;
  let currentLiveStudentTiles = [];
  const QUESTIONS_STANDARDS_EXPORT_ENDPOINT = '/api/profile/questions-standards/export.csv';
  const LIVE_STUDENT_STATUS_TAGS = [
    'active',
    'idle',
    'no-question',
    'needs-review',
    'out-of-questions',
    'formula-tutor'
  ];

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
        teacherAuthenticated: false,
        teacher: null,
        message: 'Could not load profile status.'
      });
    }
  }

  function renderProfileStatus(data) {
    currentProfileStatus = data || null;
    const teacher = data && data.teacher && typeof data.teacher === 'object' ? data.teacher : null;
    const googleConfigured = Boolean(data && data.googleConfigured);
    const gmailConnected = Boolean(data && data.gmailConnected);
    const teacherAuthenticated = Boolean(data && (data.teacherAuthenticated || data.authenticated));
    const localUsername = data?.username || teacher?.username || '';
    const linkedGoogleEmail = data?.linkedGoogleEmail || teacher?.linkedGoogleEmail || '';
    const linkedGoogleName = data?.linkedGoogleName || teacher?.linkedGoogleName || '';

    setText('profileConnectionMessage', data?.message || 'Google sign-in is not connected yet.');
    setText('profileStatusPill', teacherAuthenticated ? 'Local login active' : 'Not signed in');
    setText(
      'profileHelpText',
      gmailConnected
        ? 'Google identity is linked to this local teacher account.'
        : 'Google can be connected later for email and identity features.'
    );
    setText('profileLocalUsername', localUsername || 'Not available');
    setText('profileGoogleStatus', gmailConnected ? 'Connected' : 'Not connected');
    setText('profileEmail', linkedGoogleEmail || 'Not connected');
    setText('profileGoogleName', linkedGoogleName || 'Not available');
    setText('profileAvatar', initialsForTeacher({
      firstName: linkedGoogleName.split(/\s+/)[0] || '',
      lastName: linkedGoogleName.split(/\s+/).slice(1).join(' '),
      email: linkedGoogleEmail || localUsername || 'T'
    }));
    setText(
      'profileEmailNotice',
      gmailConnected ? 'Gmail is connected for future daily reports.' : 'Connect Gmail before sending daily reports.'
    );

    const emailButton = byId('profileSendDailyEmail');
    if (emailButton) emailButton.disabled = !gmailConnected;

    const connectButton = byId('profileConnectGoogleButton');
    if (connectButton) {
      connectButton.disabled = !googleConfigured;
      connectButton.textContent = gmailConnected ? 'Reconnect Google' : 'Connect Google';
      connectButton.title = googleConfigured
        ? 'Connect this local app to a teacher Gmail account.'
        : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the app.';
    }

    const disconnectButton = byId('profileDisconnectGoogleButton');
    if (disconnectButton) {
      disconnectButton.hidden = !gmailConnected;
      disconnectButton.disabled = !gmailConnected;
    }
  }

  async function loadStudentControls() {
    if (!byId('studentCopyInspectLockEnabled')) return;

    try {
      loadingStudentControls = true;
      setText('studentControlsStatus', 'Loading student controls...');
      const data = await fetchJson('/api/classroom-controls');
      renderStudentControls(data.controls || data);
      renderStudentLanHint(data.network || null);
      setText('studentControlsStatus', 'Student controls loaded.');
    } catch (error) {
      setText('studentControlsStatus', error.message || 'Could not load student controls.');
    } finally {
      loadingStudentControls = false;
    }
  }

  function renderStudentControls(controls) {
    const copyLock = byId('studentCopyInspectLockEnabled');
    const guidedFormulaTutor = byId('studentGuidedFormulaTutoringEnabled');
    const rateLimit = byId('studentQuestionRateLimitEnabled');
    const perMinute = byId('studentQuestionsPerMinute');

    if (copyLock) copyLock.checked = controls?.studentCopyInspectLockEnabled !== false;
    if (guidedFormulaTutor) guidedFormulaTutor.checked = controls?.studentGuidedFormulaTutoringEnabled !== false;
    if (rateLimit) rateLimit.checked = controls?.studentQuestionRateLimitEnabled !== false;
    if (perMinute) perMinute.value = String(Number(controls?.studentQuestionsPerMinute) || 6);
    updateQuestionSpeedSummary();
  }

  function renderStudentLanHint(network) {
    const hint = byId('profileStudentLanHint');
    if (!hint) return;

    const urls = Array.isArray(network?.suggestedBaseUrls)
      ? network.suggestedBaseUrls.map((url) => String(url || '').trim()).filter(Boolean)
      : [];
    const suggestion = urls[0] ? ` Suggested: ${urls[0]}` : '';
    hint.textContent = `Phones/tablets must be on the same local network as this teacher device.${suggestion}`;
  }

  function updateQuestionSpeedSummary() {
    const enabled = byId('studentQuestionRateLimitEnabled')?.checked;
    const perMinute = Number(byId('studentQuestionsPerMinute')?.value || 6) || 6;
    setText('liveQuestionSpeedValue', enabled ? `${perMinute}/min` : 'Open');
    setText(
      'liveQuestionSpeedHint',
      enabled
        ? `Up to ${perMinute}/min.`
        : 'No limit.'
    );
  }

  async function saveStudentControls() {
    if (loadingStudentControls) return;

    const copyLock = byId('studentCopyInspectLockEnabled');
    const guidedFormulaTutor = byId('studentGuidedFormulaTutoringEnabled');
    const rateLimit = byId('studentQuestionRateLimitEnabled');
    const perMinute = byId('studentQuestionsPerMinute');
    const questionsPerMinute = Number(perMinute?.value || 6);

    if (!Number.isInteger(questionsPerMinute) || questionsPerMinute < 1 || questionsPerMinute > 30) {
      setText('studentControlsStatus', 'Question limit must be from 1 to 30.');
      return;
    }

    try {
      setText('studentControlsStatus', 'Saving student controls...');
      const data = await fetchJson('/api/classroom-controls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentCopyInspectLockEnabled: Boolean(copyLock?.checked),
          studentGuidedFormulaTutoringEnabled: Boolean(guidedFormulaTutor?.checked),
          studentQuestionRateLimitEnabled: Boolean(rateLimit?.checked),
          studentQuestionsPerMinute: questionsPerMinute
        })
      });
      renderStudentControls(data.controls || data);
      setText('studentControlsStatus', 'Saved.');
    } catch (error) {
      setText('studentControlsStatus', error.message || 'Could not save student controls.');
    }
  }

  async function loadDates(preferredDate = '') {
    const select = byId('profileDateSelect');
    if (!select) return;

    setText('profileDateStatus', 'Loading activity dates...');

    try {
      const data = await fetchJson('/api/profile/dates');
      const dates = Array.isArray(data.dates) ? data.dates.filter(Boolean) : [];
      availableActivityDates = dates;
      const selectedDate = firstDateKey(preferredDate, select.value, currentDate, data.defaultDate, todayKey());
      currentDate = selectedDate || todayKey();
      const optionDates = dates.includes(currentDate) ? dates : [currentDate, ...dates];

      select.innerHTML = optionDates.length
        ? optionDates.map((date) => `<option value="${escapeAttr(date)}">${escapeHtml(date === todayKey() ? 'Today' : date)}</option>`).join('')
        : `<option value="${escapeAttr(currentDate)}">${escapeHtml(currentDate)}</option>`;
      select.value = currentDate;
      select.disabled = false;
      syncReportDateSelect(optionDates, currentDate);

      setLiveDateStatus(currentDate, null);

      await loadSummary(currentDate);
    } catch (error) {
      currentDate = todayKey();
      availableActivityDates = [currentDate];
      select.innerHTML = `<option value="${escapeAttr(currentDate)}">${escapeHtml(currentDate)}</option>`;
      select.value = currentDate;
      select.disabled = false;
      syncReportDateSelect([currentDate], currentDate);
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
      const selectedDate = currentDate || byId('profileDateSelect')?.value || todayKey();
      const data = await fetchJson('/api/profile/standards-summary?date=' + encodeURIComponent(selectedDate));
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
    const reviewCount = questions.filter(questionNeedsReview).length;
    const matchedToStandards = countQuestionsWithStandards(questions);
    const topTopic = topics[0]?.topic ? titleCaseLabel(topics[0].topic) : '-';
    const untaggedQuestions = Math.max(0, total - currentStandardsTagged);
    const selectedDate = data.date || currentDate || todayKey();
    currentDate = selectedDate;

    setText('liveStatusValue', total ? 'Active' : 'Ready');
    setText('profileTotalQuestions', `${total} question${total === 1 ? '' : 's'} ${selectedDate === todayKey() ? 'today' : 'on this date'}`);
    setText('reportQuestionsAskedValue', total);
    setText('profileNeedsReviewValue', reviewCount);
    setText('profileStandardsTaggedValue', currentStandardsTagged);
    setText('reportStandardsTaggedValue', currentStandardsTagged || matchedToStandards);
    setText('reportUntaggedQuestionsValue', untaggedQuestions);
    setText('reportTopTopicValue', topTopic);
    setText('reportNeedsReviewValue', reviewCount);
    setText('reportDateRangeValue', selectedDate);
    setAttentionCount('profileNeedsReviewValue', reviewCount);
    setAttentionCount('reportNeedsReviewValue', reviewCount);
    updateLiveAttentionState(reviewCount);
    renderLiveAttentionActions(questions);
    setLiveDateStatus(selectedDate, total);
    setText(
      'profileSummaryStatus',
      total ? `Live activity for ${selectedDate}.` : 'No question activity loaded yet.'
    );
    setText(
      'profileDailySummaryText',
      total
        ? `${total} question${total === 1 ? '' : 's'} on ${selectedDate}; top topic is ${topTopic === '-' ? 'none yet' : topTopic}.`
        : 'No question activity was logged for this date yet.'
    );

    currentQuestions = questions;
    currentReportQuestions = questions;
    showingReviewQuestions = false;
    updateTeacherReportSummary();
    renderQuestionRows(currentQuestions);
    renderReportQuestionRows(getFilteredReportQuestions());
    renderTopicSummary(topics);
  }

  function renderSummaryError(message) {
    setText('liveStatusValue', 'Offline');
    setText('profileTotalQuestions', '0 questions today');
    setText('reportQuestionsAskedValue', 0);
    setText('profileNeedsReviewValue', 0);
    setText('profileStandardsTaggedValue', currentStandardsTagged);
    setText('reportStandardsTaggedValue', currentStandardsTagged);
    setText('reportUntaggedQuestionsValue', 0);
    setText('reportTopTopicValue', '-');
    setText('reportNeedsReviewValue', 0);
    setText('reportDateRangeValue', currentDate || todayKey());
    setAttentionCount('profileNeedsReviewValue', 0);
    setAttentionCount('reportNeedsReviewValue', 0);
    updateLiveAttentionState(0);
    renderLiveAttentionActions([]);
    setLiveDateStatus(currentDate || todayKey(), 0);
    setText('profileSummaryStatus', message);
    setText('profileDailySummaryText', message);
    currentQuestions = [];
    currentReportQuestions = [];
    showingReviewQuestions = false;
    updateTeacherReportSummary(message);
    renderQuestionRows([]);
    renderReportQuestionRows([]);
    renderTopicSummary([]);
  }

  function renderStandardsSummaryReport(summary) {
    const safeSummary = normalizeStandardsSummary(summary);
    const total = safeSummary.totalQuestions;
    const tagged = safeSummary.taggedQuestions;
    const percentTagged = total ? Math.round((tagged / total) * 1000) / 10 : 0;
    const generatedLabel = formatDateTime(safeSummary.generatedAt);
    currentStandardsTagged = tagged;
    currentStandardsSummary = safeSummary;
    currentReportQuestions = safeSummary.questions;
    syncReportDateSelect(safeSummary.availableDates, currentDate || byId('reportDateSelect')?.value || todayKey());

    setText('standardsTotalQuestions', total);
    setText('standardsTaggedQuestions', tagged);
    setText('standardsUntaggedQuestions', safeSummary.untaggedQuestions);
    setText('standardsTaggedPercent', formatPercent(percentTagged));
    setText('standardsTaggedPercentValue', formatPercent(percentTagged));
    setText('standardsGeneratedAt', generatedLabel);
    setText('standardsConfidenceStrong', safeSummary.standardsConfidence.strong);
    setText('standardsConfidenceMedium', safeSummary.standardsConfidence.medium);
    setText('standardsConfidenceWeak', safeSummary.standardsConfidence.weak);
    setText('standardsConfidenceNone', safeSummary.standardsConfidence.none);
    setText(
      'standardsSummaryStatus',
      generatedLabel === 'Not available' ? 'Standards report loaded.' : `Generated ${generatedLabel}.`
    );
    setText('profileStandardsTaggedValue', tagged);
    setText('reportStandardsTaggedValue', tagged);
    setText('reportUntaggedQuestionsValue', safeSummary.untaggedQuestions);
    setText('reportDateRangeValue', currentDate || byId('reportDateSelect')?.value || todayKey());
    updateTeacherReportSummary();
    const coverageDonut = byId('standardsCoverageDonut');
    if (coverageDonut) coverageDonut.style.setProperty('--coverage-percent', String(Math.max(0, Math.min(100, percentTagged))));
    renderLiveAttentionActions(currentQuestions);

    renderStandardsReportEmptyState(safeSummary);
    renderStandardsRows(safeSummary.standards, safeSummary.concepts, safeSummary.taggedQuestions);
    renderConceptRows(safeSummary.concepts);
    renderUnitRows(safeSummary.units);
    renderRouteRows(safeSummary.routeTypes);
    renderRecentTaggedQuestions(safeSummary.recentTaggedQuestions);
    renderReportQuestionRows(getFilteredReportQuestions());
  }

  function renderStandardsSummaryError(message) {
    const emptySummary = normalizeStandardsSummary({});
    setText('standardsTotalQuestions', 0);
    setText('standardsTaggedQuestions', 0);
    setText('standardsUntaggedQuestions', 0);
    setText('standardsTaggedPercent', '0%');
    setText('standardsTaggedPercentValue', '0%');
    setText('standardsGeneratedAt', 'Not loaded');
    setText('standardsConfidenceStrong', 0);
    setText('standardsConfidenceMedium', 0);
    setText('standardsConfidenceWeak', 0);
    setText('standardsConfidenceNone', 0);
    setText('standardsSummaryStatus', message);
    currentStandardsSummary = normalizeStandardsSummary({});
    currentReportQuestions = [];
    renderStandardsReportEmptyState(emptySummary, message);
    renderStandardsRows([]);
    renderConceptRows([]);
    renderUnitRows([]);
    renderRouteRows([]);
    renderRecentTaggedQuestions([]);
    renderReportQuestionRows(getFilteredReportQuestions());
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
      message = 'No standards were tagged for this date.';
    }

    state.hidden = !message;
    state.textContent = message;
  }

  function renderStandardsRows(standards, concepts = [], taggedTotal = 0) {
    const rows = byId('standardsSummaryRows');
    if (!rows) return;
    const standardsRows = Array.isArray(standards) ? standards : [];
    const conceptRows = Array.isArray(concepts) ? concepts : [];
    const combinedRows = [
      ...standardsRows.map((item) => ({
        label: item.standardId ? `${item.standardId}: ${item.label || 'No label'}` : item.label || 'Unknown standard',
        count: toCount(item.count),
        examples: item.exampleQuestions
      })),
      ...conceptRows.map((item) => ({
        label: item.title || item.id || 'Unknown concept',
        count: toCount(item.count),
        examples: item.exampleQuestions
      }))
    ].sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));

    if (!combinedRows.length) {
      rows.innerHTML = `
        <div class="profile-empty-state standards-empty-block" role="row">
          <strong>No standards matched yet.</strong>
          <span>Tag questions to start building your standards report.</span>
        </div>
      `;
      return;
    }

    rows.innerHTML = combinedRows.map((item, index) => `
      <div class="standards-report-row standards-table-row" role="row">
        <span role="cell">${index + 1}</span>
        <span role="cell" title="${escapeAttr(item.label || '')}">${escapeHtml(truncate(item.label || 'No label', 150))}</span>
        <span role="cell">${escapeHtml(formatNumber(item.count))}</span>
        <span role="cell">${escapeHtml(formatPercent(taggedTotal ? (item.count / taggedTotal) * 100 : 0))}</span>
        <div role="cell">${renderExampleQuestions(item.examples)}</div>
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
      rows.innerHTML = `<p class="profile-empty-state">${
        showingReviewQuestions ? 'No review-needed questions found for this date.' : 'No question activity loaded yet.'
      }</p>`;
      renderReportQuestionRows(getFilteredReportQuestions());
      return;
    }

    rows.innerHTML = questions.map((item) => {
      const review = reviewStatusForQuestion(item);
      const timeParts = formatQuestionTimeParts(item);
      const topic = titleCaseLabel(item.topic || 'other') || 'Other';
      const source = liveSourceLabel(item, topic);
      return `
      <article class="live-feed-item ${review.needsReview ? 'needs-review-row' : ''}">
        <div class="live-feed-meta">
          <time datetime="${escapeAttr(item.timestamp || '')}" title="${escapeAttr([timeParts.date, timeParts.time].filter(Boolean).join(' '))}">
            ${escapeHtml(timeParts.time || item.time || 'Now')}
          </time>
          <span>${escapeHtml(source)}</span>
        </div>
        <p title="${escapeAttr(item.question || '')}">${escapeHtml(item.question || 'No question text')}</p>
        <div class="live-feed-state">
          <span class="live-status-pill ${review.needsReview ? 'no-match' : 'matched'}">${escapeHtml(review.label)}</span>
          <span class="live-confidence-pill ${escapeAttr(confidenceClass(questionConfidence(item)))}">${escapeHtml(confidenceLabel(questionConfidence(item)))}</span>
          ${review.needsReview ? '<button type="button" class="small-button secondary-small live-review-button" data-live-review-action>Review</button>' : ''}
        </div>
      </article>
    `;
    }).join('');
    renderReportQuestionRows(getFilteredReportQuestions());
  }

  function renderReportQuestionRows(questions) {
    const rows = byId('reportQuestionRows');
    renderReportSessionGroups(currentReportQuestions);
    if (!rows) return;
    const table = rows.closest('.questions-standards-table');
    const rowCount = Array.isArray(questions) ? questions.length : 0;

    updateReportFilterButtons();
    updateReportQuestionCount(questions);
    updateExportButtonStates(questions);
    if (table) {
      table.classList.toggle('has-many-rows', rowCount > 5);
      table.classList.toggle('has-few-rows', rowCount > 0 && rowCount <= 5);
    }

    if (!rowCount) {
      rows.innerHTML = `
        <div class="profile-empty-state questions-empty-state" role="row">
          <strong>${escapeHtml(emptyReportTitle())}</strong>
          <span>${escapeHtml(emptyReportMessage())}</span>
        </div>
      `;
      return;
    }

    rows.innerHTML = questions.map((item) => {
      const review = reviewStatusForQuestion(item);
      const standards = formatQuestionStandards(item);
      const standardsHtml = renderQuestionStandardsCell(item);
      const timeParts = formatQuestionTimeParts(item);
      const topic = titleCaseLabel(item.topic || 'other') || 'Other';

      return `
        <div class="profile-table-row ${review.needsReview ? 'needs-review-row' : ''}" role="row">
          <span role="cell" class="report-time-cell">
            <span>${escapeHtml(timeParts.date)}</span>
            <small>${escapeHtml(timeParts.time)}</small>
          </span>
          <span role="cell" class="report-question-cell">${escapeHtml(item.question || 'No question text')}</span>
          <span role="cell">${escapeHtml(topic)}</span>
          <span role="cell" class="report-standard-cell" title="${escapeAttr(standards)}">${standardsHtml}</span>
        </div>
      `;
    }).join('');
  }

  function renderReportSessionGroups(questions) {
    const container = byId('reportSessionGroups');
    if (!container) return;

    const archiveableGroups = buildArchiveableReportSessionGroups(questions);
    const archivedGroups = buildReportSessionGroups(questions);
    setText('reportSessionGroupCount', `${archivedGroups.length} archived`);

    if (!archiveableGroups.length && !archivedGroups.length) {
      container.innerHTML = `
        <p class="profile-empty-state">Ask questions from a student link first. Saved sessions will appear here after you archive them.</p>
      `;
      return;
    }

    container.innerHTML = [
      renderArchiveableReportSessionGroups(archiveableGroups, questions),
      archivedGroups.map(renderReportSessionGroup).join('')
    ].filter(Boolean).join('');
  }

  function buildArchiveableReportSessionGroups(questions) {
    const groups = new Map();

    (Array.isArray(questions) ? questions : []).forEach((question, index) => {
      if (isArchivedReportQuestion(question)) return;
      const questionText = firstText(question?.question, question?.studentQuestion, question?.message);
      if (!questionText) return;

      const sessionKey = firstText(question?.sessionKey, question?.sessionId, question?.classSessionId);
      const fallbackKey = sessionKey || `missing-session-key-${index + 1}`;
      const storedLabel = firstText(question?.className, question?.sessionLabel);
      const existing = groups.get(fallbackKey) || {
        sessionKey,
        fallbackKey,
        label: normalizeRestartedSessionTitle(storedLabel) || 'Current student question set',
        className: cleanRestartSessionBaseName(storedLabel),
        questionCount: 0,
        needsReviewCount: 0,
        missingStandardCount: 0,
        latestQuestionAt: '',
        standardIds: new Set(),
        topics: new Map()
      };

      const review = reviewStatusForQuestion(question);
      existing.questionCount += 1;
      if (review.needsReview) existing.needsReviewCount += 1;
      if (!hasQuestionStandard(question)) existing.missingStandardCount += 1;
      existing.label = normalizeRestartedSessionTitle(firstText(storedLabel, existing.label));
      existing.className = firstText(existing.className, cleanRestartSessionBaseName(storedLabel));
      existing.latestQuestionAt = latestLabel(existing.latestQuestionAt, question?.timestamp);
      addQuestionStandardsToGroup(existing, question);
      incrementClientCount(existing.topics, question?.topic);
      groups.set(fallbackKey, existing);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        standardCount: group.standardIds.size,
        topTopic: topClientCountLabel(group.topics)
      }))
      .sort((a, b) => String(b.latestQuestionAt || '').localeCompare(String(a.latestQuestionAt || '')));
  }

  function renderArchiveableReportSessionGroups(groups, questions) {
    if (!groups.length) {
      const hasCurrentQuestions = (Array.isArray(questions) ? questions : [])
        .some((question) => !isArchivedReportQuestion(question) && firstText(question?.question, question?.studentQuestion, question?.message));
      if (!hasCurrentQuestions) return '';
      return `
        <div class="report-session-save-panel" data-report-session-save-panel>
          <p class="profile-empty-state">These current questions are missing a session key, so they cannot be saved as restartable sessions yet.</p>
        </div>
      `;
    }

    return `
      <div class="report-session-save-panel" data-report-session-save-panel>
        <div class="report-session-save-head">
          <strong>Current Sessions Ready to Save</strong>
          <span>End a question set here to make it restartable later.</span>
        </div>
        ${groups.map(renderArchiveableReportSessionGroup).join('')}
      </div>
    `;
  }

  function renderArchiveableReportSessionGroup(group) {
    const canArchive = Boolean(firstText(group.sessionKey));
    const needsReviewLabel = group.needsReviewCount
      ? `${group.needsReviewCount} question${group.needsReviewCount === 1 ? '' : 's'}`
      : 'None';
    const missingStandardLabel = group.missingStandardCount
      ? `${group.missingStandardCount} question${group.missingStandardCount === 1 ? '' : 's'}`
      : 'None';
    const metaRows = [
      ['Questions', `${group.questionCount}`],
      ['Matched standards', `${group.standardCount || 0}`],
      ['Needs review', needsReviewLabel],
      ['Missing standards', missingStandardLabel],
      ['Top topic', group.topTopic],
      ['Latest question', group.latestQuestionAt ? formatDateTime(group.latestQuestionAt) : 'Not available']
    ].filter(([, value]) => firstText(value));

    return `
      <article class="report-session-group report-session-save-group" data-report-current-session-group data-session-key="${escapeAttr(group.sessionKey || '')}">
        <div class="report-session-group-copy">
          <div class="report-session-group-title">
            <strong>${escapeHtml(group.label || 'Current student question set')}</strong>
            <span class="report-session-state-pill">Current</span>
          </div>
          <span class="report-session-group-key">${escapeHtml(group.sessionKey ? truncate(group.sessionKey, 96) : 'Missing session key')}</span>
          <dl class="report-session-group-meta">
            ${metaRows.map(([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `).join('')}
          </dl>
          ${canArchive ? '' : '<p class="report-session-unavailable">Save is unavailable because this question set is missing a session key.</p>'}
        </div>
        <button
          type="button"
          class="small-button secondary-small report-session-archive-button"
          data-archive-student-session="${escapeAttr(group.sessionKey || '')}"
          data-archive-session-class-name="${escapeAttr(group.className || '')}"
          ${canArchive ? '' : 'disabled aria-disabled="true" title="Save unavailable: no session key."'}
        >${canArchive ? 'Save as Restartable Session' : 'Save unavailable'}</button>
      </article>
    `;
  }

  function buildReportSessionGroups(questions) {
    const groups = new Map();

    (Array.isArray(questions) ? questions : []).forEach((question, index) => {
      if (!isArchivedReportQuestion(question)) return;

      const restartKey = firstText(
        question?.sessionKey,
        question?.sessionId,
        question?.classSessionId,
        question?.archiveId ? `archive:${question.archiveId}` : '',
        question?.archiveCsvFilename ? `archive-file:${question.archiveCsvFilename}` : '',
        question?.id ? `question:${question.id}` : '',
        `archived-session-${index + 1}`
      );
      const storedLabel = firstText(question?.className, question?.sessionLabel);
      const restartClassName = cleanRestartSessionBaseName(storedLabel);
      const existing = groups.get(restartKey) || {
        restartKey,
        label: normalizeRestartedSessionTitle(storedLabel),
        restartClassName,
        restartedLink: restartedReportSessions.get(restartKey) || null,
        archivedAt: '',
        questionCount: 0,
        needsReviewCount: 0,
        missingStandardCount: 0,
        standardIds: new Set(),
        standardCounts: new Map(),
        topics: new Map(),
        status: question?.archived === true ? 'Archived' : 'Completed'
      };

      const review = reviewStatusForQuestion(question);
      existing.questionCount += 1;
      if (review.needsReview) existing.needsReviewCount += 1;
      if (!hasQuestionStandard(question)) existing.missingStandardCount += 1;
      existing.label = normalizeRestartedSessionTitle(firstText(storedLabel, existing.label));
      existing.restartClassName = firstText(existing.restartClassName, restartClassName);
      existing.restartedLink = restartedReportSessions.get(restartKey) || existing.restartedLink;
      existing.archivedAt = latestLabel(existing.archivedAt, question?.archiveCreatedAt, question?.timestamp);
      addQuestionStandardsToGroup(existing, question);
      incrementClientCount(existing.topics, question?.topic);
      if (question?.archived === true) existing.status = 'Archived';
      groups.set(restartKey, existing);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        standardCount: group.standardIds.size,
        topStandardId: topClientCountLabel(group.standardCounts),
        topTopic: topClientCountLabel(group.topics)
      }))
      .sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')));
  }

  function isArchivedReportQuestion(question) {
    return Boolean(
      question?.archived === true ||
      question?.completed === true ||
      firstText(question?.archiveId, question?.archiveCreatedAt, question?.archiveCsvFilename)
    );
  }

  function addQuestionStandardsToGroup(group, question) {
    getQuestionStandards(question).forEach((standard) => {
      const standardId = firstText(standard?.standardId);
      if (!standardId) return;
      group.standardIds.add(standardId);
      incrementClientCount(group.standardCounts, standardId);
    });
  }

  function latestLabel(...values) {
    return values.map(firstText).filter(Boolean).sort().pop() || '';
  }

  function renderReportSessionGroup(group) {
    const canRestart = Boolean(firstText(group.restartKey));
    const standardLabel = `${group.standardCount || 0} matched standard${group.standardCount === 1 ? '' : 's'}`;
    const needsReviewLabel = group.needsReviewCount
      ? `${group.needsReviewCount} question${group.needsReviewCount === 1 ? '' : 's'}`
      : 'None';
    const missingStandardLabel = group.missingStandardCount
      ? `${group.missingStandardCount} question${group.missingStandardCount === 1 ? '' : 's'}`
      : 'None';
    const statusText = group.needsReviewCount
      ? 'Review recommended before export.'
      : 'Ready to restart or export.';
    const metaRows = [
      ['Archived', group.archivedAt ? formatDateTime(group.archivedAt) : 'Not available'],
      ['Questions', `${group.questionCount}`],
      ['Matched standards', standardLabel],
      ['Needs review', needsReviewLabel],
      ['Missing standards', missingStandardLabel],
      ['Top topic', group.topTopic],
      ['Top standard', group.topStandardId],
      ['Status', statusText]
    ].filter(([, value]) => firstText(value));

    return `
      <article class="report-session-group" data-report-session-group data-session-key="${escapeAttr(group.restartKey)}">
        <div class="report-session-group-copy">
          <div class="report-session-group-title">
            <strong>${escapeHtml(group.label || 'Archived Session')}</strong>
            <span class="report-session-state-pill">${escapeHtml(group.status || 'Archived')}</span>
          </div>
          <span class="report-session-group-key">${escapeHtml(truncate(group.restartKey || 'No session key available', 96))}</span>
          <dl class="report-session-group-meta">
            ${metaRows.map(([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `).join('')}
          </dl>
          ${renderRestartedReportSessionLink(group.restartedLink)}
        </div>
        <button
          type="button"
          class="small-button secondary-small report-session-restart-button"
          data-restart-student-session="${escapeAttr(group.restartKey)}"
          data-restart-session-class-name="${escapeAttr(group.restartClassName || '')}"
          ${canRestart ? '' : 'disabled aria-disabled="true" title="Restart unavailable: no archived session key."'}
        >${canRestart ? 'Restart Session' : 'Restart unavailable'}</button>
      </article>
    `;
  }

  function renderRestartedReportSessionLink(restartedLink) {
    const studentUrl = firstText(restartedLink?.studentUrl);
    if (!studentUrl) return '';

    return `
      <div class="active-session-link" data-restarted-session-link-panel role="status" aria-live="polite">
        <strong>Session restarted</strong>
        <span>New student link is ready:</span>
        <code>${escapeHtml(studentUrl)}</code>
        <div class="active-session-actions">
          <button type="button" class="small-button secondary-small" data-copy-restarted-student-url="${escapeAttr(studentUrl)}">Copy Link</button>
          <a class="small-button secondary-small active-session-open-button" href="${escapeAttr(studentUrl)}" target="_blank" rel="noreferrer">Open Student Link</a>
        </div>
      </div>
    `;
  }

  function updateReportQuestionCount(questions) {
    const visible = Array.isArray(questions) ? questions.length : 0;
    const total = Array.isArray(currentReportQuestions) ? currentReportQuestions.length : 0;
    setText('reportQuestionCount', `Showing ${visible} of ${total}`);
  }

  function reviewQuestions() {
    const reviewQuestions = currentQuestions.filter(questionNeedsReview);
    const table = byId('profileQuestionRows');

    showingReviewQuestions = true;
    renderQuestionRows(reviewQuestions);

    if (reviewQuestions.length) {
      setText(
        'profileSummaryStatus',
        `Showing ${reviewQuestions.length} question${reviewQuestions.length === 1 ? '' : 's'} that need teacher review.`
      );
      updateTeacherReportSummary();
      table?.closest('.recent-questions-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      table?.querySelector('.needs-review-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    setText('profileSummaryStatus', 'No review-needed questions found for this date.');
    updateTeacherReportSummary();
    table?.closest('.recent-questions-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderTopicSummary(topics) {
    const summary = byId('profileTopicSummary');
    if (!summary) return;

    const rows = buildTopicSummaryRows(topics);
    summary.className = 'topic-summary-list';
    summary.innerHTML = rows.map((item) => {
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

  function buildTopicSummaryRows(topics) {
    const sourceRows = Array.isArray(topics) ? topics : [];
    const keyed = new Map();
    const total = sourceRows.reduce((sum, item) => sum + toCount(item?.count), 0);

    sourceRows.forEach((item) => {
      const key = topicBucketKey(item?.topic);
      if (!key) return;
      const existing = keyed.get(key) || { topic: topicLabelForKey(key), count: 0, percent: 0 };
      existing.count += toCount(item.count);
      keyed.set(key, existing);
    });

    const preferredKeys = ['definition', 'science formula', 'no match'];
    const preferredRows = preferredKeys.map((key) => {
      const row = keyed.get(key) || { topic: topicLabelForKey(key), count: 0, percent: 0 };
      return {
        topic: row.topic,
        count: row.count,
        percent: total ? (row.count / total) * 100 : 0
      };
    });

    const extraRows = Array.from(keyed.entries())
      .filter(([key]) => !preferredKeys.includes(key))
      .map(([, row]) => ({
        topic: row.topic,
        count: row.count,
        percent: total ? (row.count / total) * 100 : 0
      }));

    return [...preferredRows, ...extraRows];
  }

  function bindEvents() {
    byId('profileDateSelect')?.addEventListener('change', async (event) => {
      syncDateSelectValue(event.target.value);
      await loadSummary(event.target.value);
      await loadStudentSessions();
      await loadStandardsSummaryReport();
    });

    byId('reportDateSelect')?.addEventListener('change', async (event) => {
      syncDateSelectValue(event.target.value);
      await loadSummary(event.target.value);
      await loadStandardsSummaryReport();
    });

    byId('profileRefreshSummary')?.addEventListener('click', async () => {
      const selectedDate = byId('profileDateSelect')?.value || currentDate || todayKey();
      await loadProfileStatus();
      await loadDates(selectedDate);
      await loadStudentSessions();
      await loadStandardsSummaryReport();
    });

    byId('profileTodaySummary')?.addEventListener('click', async () => {
      syncDateSelectValue(todayKey());
      await loadDates(todayKey());
      await loadStudentSessions();
      await loadStandardsSummaryReport();
    });

    byId('profileRefreshStandardsReport')?.addEventListener('click', () => {
      loadStandardsSummaryReport();
    });

    byId('profileReviewQuestions')?.addEventListener('click', () => {
      reviewQuestions();
    });

    document.querySelectorAll('[data-report-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        reportQuestionFilter = button.getAttribute('data-report-filter') || 'all';
        clearQuestionsStandardsExportState();
        renderReportQuestionRows(getFilteredReportQuestions());
      });
    });

    byId('reportQuestionRows')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-standard-id]');
      if (!button) return;
      openStandardDetails(standardContextFromButton(button));
    });

    byId('reportSessionGroups')?.addEventListener('click', (event) => {
      const archiveButton = event.target.closest('[data-archive-student-session]');
      if (archiveButton) {
        archiveStudentSession(archiveButton);
        return;
      }

      const copyButton = event.target.closest('[data-copy-restarted-student-url]');
      if (copyButton) {
        copyRestartedReportSessionLink(copyButton);
        return;
      }

      const button = event.target.closest('[data-restart-student-session]');
      if (!button) return;
      restartStudentSessionFromReport(button);
    });

    byId('standardDetailsModal')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-standard-modal-close]')) closeStandardDetailsModal();
    });

    byId('liveStudentGrid')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-live-student-modal-open]');
      if (!button) return;
      openLiveStudentModal(button);
    });

    byId('liveStudentDetailsModal')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-live-student-modal-close]')) closeLiveStudentDetailsModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;

      if (!byId('liveStudentDetailsModal')?.hidden) {
        closeLiveStudentDetailsModal();
        return;
      }

      if (!byId('standardDetailsModal')?.hidden) {
        closeStandardDetailsModal();
      }
    });

    byId('reportExportCsv')?.addEventListener('click', exportReportCsv);
    byId('reportPurgeRawHistory')?.addEventListener('click', purgeQuestionsStandardsExport);
    byId('reportPrintReport')?.addEventListener('click', printReport);
    byId('reportCopySummary')?.addEventListener('click', copyReportSummary);

    byId('profileConnectGoogleButton')?.addEventListener('click', () => {
      if (!currentProfileStatus?.googleConfigured) {
        setText('profileConnectionMessage', 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart the app.');
        return;
      }

      window.location.href = currentProfileStatus.connectUrl || '/api/profile/google/start';
    });

    byId('profileDisconnectGoogleButton')?.addEventListener('click', async () => {
      const disconnectButton = byId('profileDisconnectGoogleButton');
      try {
        if (disconnectButton) disconnectButton.disabled = true;
        setText('profileConnectionMessage', 'Disconnecting Google...');
        await fetchJson(currentProfileStatus?.disconnectUrl || '/api/profile/google/disconnect', {
          method: 'POST'
        });
        await loadProfileStatus();
      } catch (error) {
        setText('profileConnectionMessage', error.message || 'Could not disconnect Google.');
      } finally {
        if (disconnectButton) disconnectButton.disabled = !currentProfileStatus?.gmailConnected;
      }
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
      const archiveButton = event.target.closest('[data-archive-student-session]');
      if (archiveButton) {
        archiveStudentSession(archiveButton);
        return;
      }

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

    byId('studentCopyInspectLockEnabled')?.addEventListener('change', saveStudentControls);
    byId('studentGuidedFormulaTutoringEnabled')?.addEventListener('change', saveStudentControls);
    byId('studentQuestionRateLimitEnabled')?.addEventListener('change', saveStudentControls);
    byId('studentQuestionsPerMinute')?.addEventListener('change', saveStudentControls);
    byId('studentQuestionsPerMinute')?.addEventListener('input', updateQuestionSpeedSummary);
    byId('profileQuestionRows')?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-live-review-action]')) return;
      reviewQuestions();
    });
    byId('liveAttentionActions')?.addEventListener('click', (event) => {
      if (!event.target.closest('[data-live-review-action]')) return;
      reviewQuestions();
    });
  }

  async function init() {
    if (initialized) return;
    if (!byId('profileDateSelect') || !byId('profileRefreshSummary')) return;

    initialized = true;
    bindEvents();
    await loadProfileStatus();
    await loadStudentControls();
    await loadDates();
    await loadStudentSessions();
    startStudentSessionRefresh();
    await loadStandardsSummaryReport();
  }

  async function refreshActiveProfileBlade() {
    if (!initialized || !byId('profileDateSelect')) return;
    await loadDates(byId('profileDateSelect')?.value || currentDate);
    await loadStudentControls();
    await loadStudentSessions();
    await loadStandardsSummaryReport();
  }

  function setText(id, text) {
    const element = byId(id);
    if (element) element.textContent = String(text);
  }

  function setAttentionCount(id, count) {
    const element = byId(id);
    const card = element?.closest('[data-needs-review-card]');
    if (card) card.classList.toggle('has-attention', Number(count) > 0);
  }

  function syncReportDateSelect(dates, selectedDate) {
    const select = byId('reportDateSelect');
    if (!select) return;

    const safeDates = Array.isArray(dates) ? dates.filter(Boolean) : [];
    const value = selectedDate || safeDates[0] || todayKey();
    const optionDates = safeDates.includes(value) ? safeDates : [value, ...safeDates];
    select.innerHTML = optionDates.length
      ? optionDates.map((date) => `<option value="${escapeAttr(date)}">${escapeHtml(date)}</option>`).join('')
      : `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`;
    select.value = value;
    select.disabled = false;
  }

  function syncDateSelectValue(value) {
    currentDate = value || currentDate || todayKey();
    const profileSelect = byId('profileDateSelect');
    const reportSelect = byId('reportDateSelect');
    if (
      profileSelect
      && profileSelect.value !== currentDate
      && Array.from(profileSelect.options || []).some((option) => option.value === currentDate)
    ) {
      profileSelect.value = currentDate;
    }
    if (reportSelect && reportSelect.value !== currentDate) reportSelect.value = currentDate;
    setText('reportDateRangeValue', currentDate);
    clearQuestionsStandardsExportState();
  }

  function renderStudentLink(studentUrl) {
    currentStudentUrl = studentUrl;
    const panel = byId('profileStudentLinkPanel');
    const link = byId('profileStudentUrl');
    const details = byId('profileStudentUrlDetails');

    if (panel) panel.hidden = !studentUrl;
    if (link) {
      link.textContent = studentUrl ? 'Open Classroom View' : '';
      link.href = studentUrl || '#';
    }
    if (details) details.textContent = studentUrl || '';

    setText(
      'profileStudentLinkStatus',
      studentUrl ? 'Class link ready in Active Sessions.' : 'No student link created yet.'
    );
  }

  function setLiveDateStatus(date, questionCount) {
    const selectedDate = date || currentDate || todayKey();
    const isToday = selectedDate === todayKey();
    const dateLabel = isToday ? 'today' : selectedDate;
    const hasCount = Number.isFinite(Number(questionCount));
    const questionTotal = Math.max(0, Number(questionCount || 0));
    const questionText = hasCount
      ? `${questionTotal} question${questionTotal === 1 ? '' : 's'} ${isToday ? 'so far' : 'logged'}`
      : 'Loading questions';
    const otherDates = availableActivityDates.filter((activityDate) => activityDate && activityDate !== selectedDate).length;
    const dateHint = otherDates ? ` ${otherDates} other day${otherDates === 1 ? '' : 's'} in the date menu.` : '';

    setText('profileDateStatus', `Viewing ${dateLabel}. ${questionText}.${dateHint}`);
  }

  function updateLiveAttentionState(reviewCount) {
    const count = Number(reviewCount || 0);
    const card = byId('liveAttentionSuccess')?.closest('[data-live-attention-card]');
    const success = byId('liveAttentionSuccess');
    const actions = byId('liveAttentionActions');
    const reviewButton = byId('profileReviewQuestions');

    if (card) card.classList.toggle('has-attention', count > 0);
    if (success) success.hidden = count > 0;
    if (actions) actions.hidden = count === 0;
    if (reviewButton) reviewButton.disabled = count === 0;
    setText(
      'liveAttentionHint',
      count ? `${count} item${count === 1 ? '' : 's'} queued for teacher review.` : 'No teacher action queued.'
    );
  }

  function renderLiveAttentionActions(questions) {
    const actions = byId('liveAttentionActions');
    if (!actions) return;

    const reviewItems = (Array.isArray(questions) ? questions : [])
      .filter(questionNeedsReview)
      .slice(-4)
      .reverse();

    if (!reviewItems.length) {
      actions.innerHTML = '';
      return;
    }

    const totalReviewItems = (Array.isArray(questions) ? questions : []).filter(questionNeedsReview).length;
    const extraCount = Math.max(0, totalReviewItems - reviewItems.length);
    const extraCard = extraCount
      ? `
        <article class="live-attention-action-card live-attention-more-card">
          <div class="live-attention-action-copy">
            <strong>${extraCount} more item${extraCount === 1 ? '' : 's'} need attention</strong>
            <p>Use Review Feed to scan every question that needs a teacher decision.</p>
          </div>
          <button type="button" class="small-button secondary-small" data-live-review-action>Review Feed</button>
        </article>
      `
      : '';

    actions.innerHTML = reviewItems.map(renderLiveAttentionActionCard).join('') + extraCard;
  }

  function renderLiveAttentionActionCard(item) {
    const reason = attentionReasonForQuestion(item);
    const timeParts = formatQuestionTimeParts(item);
    const answer = firstText(item?.answerGiven, item?.answer, item?.response, item?.responsePreview);
    const actionLabel = reason.actionLabel || 'Review';

    return `
      <article class="live-attention-action-card">
        <div class="live-attention-action-copy">
          <div class="live-attention-action-topline">
            <span>${escapeHtml(reason.title)}</span>
            <time datetime="${escapeAttr(item?.timestamp || '')}">${escapeHtml(timeParts.time || 'Now')}</time>
          </div>
          <strong>${escapeHtml(reason.whatHappened)}</strong>
          <dl>
            <div>
              <dt>Student question</dt>
              <dd>${escapeHtml(truncate(firstText(item?.question, item?.studentQuestion, item?.message) || 'No question text logged.', 180))}</dd>
            </div>
            <div>
              <dt>Charlemagne answer</dt>
              <dd>${escapeHtml(answer ? truncate(answer, 180) : 'No answer was logged for this item.')}</dd>
            </div>
            <div>
              <dt>Why it needs attention</dt>
              <dd>${escapeHtml(reason.why)}</dd>
            </div>
          </dl>
        </div>
        <button type="button" class="small-button secondary-small" data-live-review-action>${escapeHtml(actionLabel)}</button>
      </article>
    `;
  }

  function attentionReasonForQuestion(item) {
    if (isNoMatchQuestion(item)) {
      return {
        title: 'No trusted answer',
        whatHappened: 'Charlemagne could not confidently route this question.',
        why: 'The student may need a teacher answer or a new knowledge entry.',
        actionLabel: 'Review'
      };
    }

    if (!hasQuestionStandard(item)) {
      return {
        title: 'Missing standard',
        whatHappened: 'The question was answered, but no standard is attached.',
        why: 'Add or confirm a standard before using this in reports.',
        actionLabel: 'Review'
      };
    }

    if (String(item?.standardsError || '').trim()) {
      return {
        title: 'Standards check failed',
        whatHappened: 'The answer was logged, but standards matching had a problem.',
        why: firstText(item?.standardsError) || 'The standards match needs teacher review.',
        actionLabel: 'Review'
      };
    }

    const confidence = confidenceLabel(questionConfidence(item)).toLowerCase();
    return {
      title: 'Check answer',
      whatHappened: 'Charlemagne answered with a weak or unclear match.',
      why: `The confidence is ${confidence}, so verify the student got the right help.`,
      actionLabel: 'Review'
    };
  }

  async function loadStudentSessions() {
    if (!byId('profileStudentSessions')) return;

    try {
      const data = await fetchJson('/api/profile/live-student-activity');
      renderStudentSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      renderStudentSessions([], 'Could not load live activity. Try Refresh.');
    }
  }

  function startStudentSessionRefresh() {
    if (studentSessionRefreshTimer) return;

    studentSessionRefreshTimer = window.setInterval(() => {
      if (byId('profileStudentSessions')) {
        loadStudentSessions();
      }
    }, 15_000);
  }

  function renderStudentSessions(sessions, errorMessage = '') {
    const rows = byId('profileStudentSessions');
    const grid = byId('liveStudentGrid');
    if (!rows) return;
    const sortedSessions = normalizeLiveSessions(sessions);

    if (errorMessage) {
      currentLiveStudentTiles = [];
      setText('profileStudentSessionCount', 'Unavailable');
      setText('liveStudentConnectionValue', 'Unavailable');
      setText('liveStudentConnectionHint', 'Could not check students.');
      setText('liveStudentPresenceBreakdown', 'Unavailable');
      setText('liveStudentsUpdatedAt', 'Could not load live activity.');
      setText('liveRunningSessionsValue', 'Unavailable');
      setText('liveSessionDurationValue', 'Could not check sessions.');
      setText('liveMessageCountValue', 'Unavailable');
      setText('liveRecentQuestionCountValue', 'Could not check questions.');
      setText('liveTopStandardValue', '-');
      setText('liveTopTopicValue', '-');
      setText('profileSummaryStatus', 'Could not load live activity. Try Refresh.');
      setText('liveStatusValue', 'Offline');
      rows.innerHTML = `<p class="profile-empty-state">${escapeHtml(errorMessage)}</p>`;
      if (grid) grid.innerHTML = `<p class="profile-empty-state">${escapeHtml(errorMessage)}</p>`;
      return;
    }

    const latestSession = sortedSessions[0] || {};
    const latestStudentUrl = latestSession.studentUrl || '';
    if (latestStudentUrl && !currentStudentUrl) renderStudentLink(latestStudentUrl);

    const liveHubs = collectLiveStudentHubs(sortedSessions);
    const activeCount = liveHubs.filter((item) => item.hub.active).length;
    const totalStudents = liveHubs.length;
    const alertCount = liveHubs.filter((item) => hasLiveAlert(item.hub)).length;
    const questionCount = liveHubs.reduce((sum, item) => sum + toCount(item.hub.messageCount), 0);
    const idleCount = Math.max(0, totalStudents - activeCount);
    const liveStats = buildLiveSummaryStats(sortedSessions, liveHubs);
    const studentNoun = totalStudents === 1 ? 'student' : 'students';

    if (!sortedSessions.length) {
      currentLiveStudentTiles = [];
      setText('profileStudentSessionCount', '0 running');
      setText('liveStudentConnectionValue', '0 active');
      setText('liveStudentConnectionHint', 'Create a class link to begin.');
      setText('liveStudentPresenceBreakdown', '0 connected / 0 idle');
      setText('liveStudentsUpdatedAt', 'Live activity loaded.');
      setText('liveRunningSessionsValue', '0');
      setText('liveSessionDurationValue', 'No session running.');
      setText('liveMessageCountValue', '0');
      setText('liveRecentQuestionCountValue', 'No recent questions.');
      setText('liveTopStandardValue', '-');
      setText('liveTopTopicValue', '-');
      setText('profileSummaryStatus', 'No students connected yet.');
      setText('liveStatusValue', 'Ready');
      rows.innerHTML = '<p class="profile-empty-state">Create a student link to start a running session.</p>';
      if (grid) {
        grid.innerHTML = '<p class="profile-empty-state">No students connected yet. Create or share the student link to begin.</p>';
      }
      if (!currentStudentUrl) renderStudentLink('');
      return;
    }

    setText('profileStudentSessionCount', `${sortedSessions.length} running`);
    setText('liveStudentConnectionValue', `${activeCount} active`);
    setText('liveStatusValue', activeCount > 0 ? 'Active' : 'Open');
    setText('liveRunningSessionsValue', `${liveStats.runningSessionCount}`);
    setText('liveSessionDurationValue', liveStats.longestRunningLabel ? `Longest session ${liveStats.longestRunningLabel}` : 'Session just started.');
    setText('liveMessageCountValue', `${liveStats.totalMessageCount}`);
    setText(
      'liveRecentQuestionCountValue',
      liveStats.recentQuestionCount
        ? `${liveStats.recentQuestionCount} recent question${liveStats.recentQuestionCount === 1 ? '' : 's'}`
        : 'No recent questions.'
    );
    setText('liveTopStandardValue', liveStats.topStandardId || '-');
    setText('liveTopTopicValue', liveStats.topTopic || '-');
    setText('liveStudentPresenceBreakdown', `${totalStudents} connected / ${idleCount} idle`);
    setText('liveStudentsUpdatedAt', `Updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
    setText(
      'liveStudentConnectionHint',
      totalStudents
        ? `${totalStudents} ${studentNoun} connected${alertCount ? `, ${alertCount} with alerts` : ''}`
        : 'Class link open, waiting for students'
    );
    setText(
      'profileSummaryStatus',
      totalStudents
        ? `${totalStudents} ${studentNoun} live now. ${questionCount} question${questionCount === 1 ? '' : 's'} asked.`
        : 'No students connected yet.'
    );

    rows.innerHTML = sortedSessions.map(renderActiveSessionCard).join('');

    if (!liveHubs.length) {
      currentLiveStudentTiles = [];
      if (grid) {
        grid.innerHTML = '<p class="profile-empty-state">No students connected yet. Create or share the student link to begin.</p>';
      }
      return;
    }

    if (grid) {
      currentLiveStudentTiles = liveHubs.map((item, index) => buildLiveStudentTile(item.hub, item.session, index));
      grid.innerHTML = currentLiveStudentTiles.map(renderLiveStudentCard).join('');
    }
  }

  function normalizeLiveSessions(sessions) {
    return (Array.isArray(sessions) ? sessions : [])
      .filter((session) => session && typeof session === 'object')
      .slice()
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function buildLiveSummaryStats(sessions, liveHubs) {
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    const safeHubs = Array.isArray(liveHubs) ? liveHubs : [];
    const standardCounts = new Map();
    const topicCounts = new Map();
    let totalMessageCount = 0;
    let recentQuestionCount = 0;
    let sessionRecentQuestionCount = 0;
    let longestRunningMs = 0;

    safeSessions.forEach((session) => {
      totalMessageCount += sessionQuestionCount(session);
      sessionRecentQuestionCount += toCount(session?.recentQuestionCount);

      const explicitMs = Number(session?.runningDurationMs || session?.durationMs);
      if (Number.isFinite(explicitMs) && explicitMs > longestRunningMs) {
        longestRunningMs = explicitMs;
      } else {
        const createdMs = new Date(firstText(session?.createdAt)).getTime();
        if (Number.isFinite(createdMs)) longestRunningMs = Math.max(longestRunningMs, Date.now() - createdMs);
      }

      incrementClientCount(standardCounts, session?.topStandardId);
      incrementClientCount(topicCounts, session?.topTopic);
    });

    safeHubs.forEach((item) => {
      const hub = item?.hub || {};
      incrementClientCount(standardCounts, hub.standardId);
      incrementClientCount(topicCounts, hub.topic);

      const messages = Array.isArray(hub.recentMessages) ? hub.recentMessages : [];
      messages.forEach((message) => {
        if (firstText(message?.question, message?.message)) recentQuestionCount += 1;
        incrementClientCount(standardCounts, message?.standardId);
        incrementClientCount(topicCounts, message?.topic);
      });
    });

    if (!recentQuestionCount) recentQuestionCount = sessionRecentQuestionCount;

    return {
      runningSessionCount: safeSessions.length,
      totalMessageCount,
      recentQuestionCount,
      longestRunningLabel: longestRunningMs > 0 ? formatDurationMs(longestRunningMs) : '',
      topStandardId: topClientCountLabel(standardCounts),
      topTopic: topClientCountLabel(topicCounts)
    };
  }

  function incrementClientCount(map, value) {
    const text = firstText(value);
    if (!text) return;
    map.set(text, (map.get(text) || 0) + 1);
  }

  function topClientCountLabel(map) {
    return Array.from(map.entries())
      .sort(([labelA, countA], [labelB, countB]) => {
        if (countB !== countA) return countB - countA;
        return String(labelA).localeCompare(String(labelB));
      })[0]?.[0] || '';
  }

  function renderActiveSessionCard(session, index) {
    const sessionId = firstText(session?.classSessionId, session?.sessionId);
    const studentUrl = firstText(session?.studentUrl);
    const className = firstText(session?.className, session?.name, session?.title) || `Class Session ${index + 1}`;
    const createdAt = firstText(session?.createdAt);
    const duration = formatRunningDuration(session);
    const studentCounts = sessionStudentCounts(session);
    const questionCount = sessionQuestionCount(session);
    const questionsLabel = questionCount === 1 ? 'question/message' : 'questions/messages';
    const archiveDisabled = sessionId ? '' : ' disabled';
    const linkDisabled = studentUrl ? '' : ' disabled';
    const openAttrs = studentUrl
      ? `href="${escapeAttr(studentUrl)}" target="_blank" rel="noreferrer"`
      : 'href="#" aria-disabled="true"';

    return `
      <article class="active-session-card" data-active-session-card data-session-id="${escapeAttr(sessionId)}">
        <div class="active-session-card-head">
          <div>
            <strong>${escapeHtml(className)}</strong>
            <time datetime="${escapeAttr(createdAt)}">${escapeHtml(formatSessionTime(createdAt))}</time>
          </div>
          <span class="active-session-running-pill">Running</span>
        </div>

        <dl class="active-session-facts">
          ${duration ? `
            <div>
              <dt>Duration</dt>
              <dd>${escapeHtml(duration)}</dd>
            </div>
          ` : ''}
          <div>
            <dt>Students</dt>
            <dd>${studentCounts.active} active / ${studentCounts.total} total</dd>
          </div>
          <div>
            <dt>Messages</dt>
            <dd>${escapeHtml(`${questionCount} ${questionsLabel}`)}</dd>
          </div>
        </dl>

        <div class="active-session-link">
          <span>Student link</span>
          <code>${escapeHtml(studentUrl || 'No student link available')}</code>
        </div>

        <div class="active-session-actions">
          <button type="button" class="small-button secondary-small" data-copy-student-url="${escapeAttr(studentUrl)}"${linkDisabled}>Copy Link</button>
          <a class="small-button secondary-small active-session-open-button${studentUrl ? '' : ' is-disabled'}" ${openAttrs}>Open Student View</a>
          <button
            type="button"
            class="small-button secondary-small danger-small"
            data-archive-student-session="${escapeAttr(sessionId)}"${archiveDisabled}
          >End Session &amp; Archive</button>
        </div>
      </article>
    `;
  }

  function sessionStudentCounts(session) {
    const students = sessionStudents(session);
    const active = Number.isFinite(Number(session?.activeAnonymousHubCount))
      ? toCount(session.activeAnonymousHubCount)
      : Number.isFinite(Number(session?.activeStudentCount))
        ? toCount(session.activeStudentCount)
      : students.filter((hub) => hub?.active).length;
    const total = Number.isFinite(Number(session?.anonymousHubCount))
      ? toCount(session.anonymousHubCount)
      : Number.isFinite(Number(session?.totalStudentCount))
        ? toCount(session.totalStudentCount)
      : students.length;
    return { active, total };
  }

  function sessionQuestionCount(session) {
    const students = sessionStudents(session);
    const fromStudents = students.reduce((sum, hub) => sum + toCount(hub?.messageCount), 0);
    if (fromStudents) return fromStudents;
    if (Number.isFinite(Number(session?.messageCount))) return toCount(session.messageCount);
    if (Number.isFinite(Number(session?.totalMessageCount))) return toCount(session.totalMessageCount);
    if (Number.isFinite(Number(session?.totalQuestions))) return toCount(session.totalQuestions);
    if (Number.isFinite(Number(session?.totalMessages))) return toCount(session.totalMessages);
    return Array.isArray(session?.messages) ? session.messages.length : 0;
  }

  function sessionStudents(session) {
    if (Array.isArray(session?.anonymousHubs)) return session.anonymousHubs;
    if (Array.isArray(session?.students)) return session.students;
    return [];
  }

  function formatRunningDuration(session) {
    const explicitDuration = firstText(session?.runningDuration, session?.duration, session?.durationLabel);
    if (explicitDuration) return explicitDuration;

    const explicitMs = Number(session?.runningDurationMs || session?.durationMs);
    if (Number.isFinite(explicitMs) && explicitMs > 0) return formatDurationMs(explicitMs);

    const createdAt = firstText(session?.createdAt);
    if (!createdAt) return '';
    const createdMs = new Date(createdAt).getTime();
    if (!Number.isFinite(createdMs)) return '';
    return formatDurationMs(Date.now() - createdMs);
  }

  function formatDurationMs(durationMs) {
    const totalMinutes = Math.max(0, Math.floor(Number(durationMs || 0) / 60_000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${Math.max(1, minutes)}m`;
  }

  function collectLiveStudentHubs(sessions) {
    return (Array.isArray(sessions) ? sessions : [])
      .flatMap((session) => {
        const hubs = sessionStudents(session);
        return hubs.map((hub) => ({ session, hub }));
      })
      .filter((item) => item.hub && typeof item.hub === 'object');
  }

  function buildLiveStudentTile(hub, session, index) {
    const displayName = firstText(hub?.displayName, hub?.label) || `Anonymous Student ${index + 1}`;
    const sessionName = firstText(session?.className, session?.name, session?.title) || 'Class Session';
    const activeState = normalizeKey(hub?.status) === 'active' || hub?.active ? 'active' : 'idle';
    const messageCount = toCount(hub?.messageCount);
    const questionsLeft = formatLiveQuestionsLeft(hub?.rateLimit);
    const statusTags = liveStudentStatusTags(hub, activeState, messageCount);

    return {
      index,
      displayName,
      sessionName,
      activeState,
      messageCount,
      countLabel: formatHubActivity(hub),
      questionsLeft,
      statusTags,
      statusLabel: liveStudentStatusLabel(statusTags, activeState),
      standardId: firstText(hub?.standardId),
      topic: firstText(hub?.topic),
      source: firstText(hub?.source),
      recentMessages: safeRecentLiveMessages(hub?.recentMessages)
    };
  }

  function renderLiveStudentCard(tile) {
    const statusAttrs = [
      `data-status-active="${tile.statusTags.includes('active') ? 'true' : 'false'}"`,
      `data-status-idle="${tile.statusTags.includes('idle') ? 'true' : 'false'}"`,
      `data-status-no-question="${tile.statusTags.includes('no-question') ? 'true' : 'false'}"`,
      `data-status-needs-review="${tile.statusTags.includes('needs-review') ? 'true' : 'false'}"`,
      `data-status-out-of-questions="${tile.statusTags.includes('out-of-questions') ? 'true' : 'false'}"`,
      `data-status-formula-tutor="${tile.statusTags.includes('formula-tutor') ? 'true' : 'false'}"`
    ].join(' ');
    const className = [
      'live-student-tile',
      ...tile.statusTags
    ].join(' ');

    return `
      <button
        type="button"
        class="${escapeAttr(className)}"
        data-live-student-modal-open
        data-live-student-index="${escapeAttr(tile.index)}"
        data-student-display-name="${escapeAttr(tile.displayName)}"
        data-session-name="${escapeAttr(tile.sessionName)}"
        data-live-state="${escapeAttr(tile.activeState)}"
        data-status-tags="${escapeAttr(tile.statusTags.join(' '))}"
        ${statusAttrs}
      >
        <strong>${escapeHtml(tile.displayName)}</strong>
        <span class="live-student-tile-status">${escapeHtml(tile.statusLabel)}</span>
        <span class="live-student-tile-count">${escapeHtml(tile.countLabel)}</span>
      </button>
    `;
  }

  function liveStudentStatusTags(hub, activeState, messageCount) {
    const alerts = hub?.alerts && typeof hub.alerts === 'object' ? hub.alerts : {};
    const tags = [activeState === 'active' ? 'active' : 'idle'];

    if (!messageCount || !firstText(hub?.latestQuestion)) tags.push('no-question');
    if (alerts.needsReview || alerts.noMatch || alerts.lowConfidence || alerts.missingStandard) tags.push('needs-review');
    if (alerts.outOfQuestions || hub?.rateLimit?.limited || Number(hub?.rateLimit?.remainingWhole) === 0) {
      tags.push('out-of-questions');
    }
    if (alerts.formulaTutorActive || normalizeKey(hub?.routeType) === 'formula tutor') tags.push('formula-tutor');

    return LIVE_STUDENT_STATUS_TAGS.filter((tag) => tags.includes(tag));
  }

  function liveStudentStatusLabel(statusTags, activeState) {
    const labels = [];
    labels.push(activeState === 'active' ? 'Active' : 'Idle');
    if (statusTags.includes('no-question')) labels.push('No question');
    if (statusTags.includes('needs-review')) labels.push('Needs review');
    if (statusTags.includes('out-of-questions')) labels.push('Out of questions');
    if (statusTags.includes('formula-tutor')) labels.push('Formula tutor');
    return labels.join(' / ');
  }

  function safeRecentLiveMessages(messages) {
    if (!Array.isArray(messages)) return [];
    return messages
      .filter((entry) => entry && typeof entry === 'object')
      .slice(-10)
      .map((entry) => ({
        time: firstText(entry.time, entry.createdAt),
        question: firstText(entry.question, entry.message),
        response: firstText(entry.response),
        standardId: firstText(entry.standardId),
        topic: firstText(entry.topic),
        source: firstText(entry.source)
      }))
      .filter((entry) => entry.question || entry.response || entry.standardId || entry.topic || entry.source);
  }

  function openLiveStudentModal(button) {
    const index = Number(button?.getAttribute('data-live-student-index'));
    if (!Number.isInteger(index)) return;

    const tile = currentLiveStudentTiles[index];
    if (!tile) return;
    showLiveStudentDetailsModal(tile);
  }

  function showLiveStudentDetailsModal(tile) {
    const modal = byId('liveStudentDetailsModal');
    const body = byId('liveStudentDetailsBody');
    const title = byId('liveStudentDetailsTitle');
    if (!modal || !body || !title) return;

    title.textContent = tile.displayName;
    body.innerHTML = renderLiveStudentDetailsBody(tile);
    modal.hidden = false;
    document.body.classList.add('live-student-details-open');
    modal.querySelector('.live-student-details-panel')?.focus();
  }

  function closeLiveStudentDetailsModal() {
    const modal = byId('liveStudentDetailsModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('live-student-details-open');
  }

  function renderLiveStudentDetailsBody(tile) {
    const metaRows = [
      ['Session', tile.sessionName],
      ['State', titleCaseLabel(tile.activeState)],
      ['Messages', tile.countLabel],
      ['Questions left', tile.questionsLeft],
      ['Standard', tile.standardId],
      ['Topic', tile.topic],
      ['Source', titleCaseLabel(tile.source) || tile.source]
    ].filter(([, value]) => firstText(value));

    return `
      <dl class="live-student-details-meta">
        ${metaRows.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join('')}
      </dl>

      <section class="live-student-details-history" aria-label="Recent chat history">
        <h5>Recent chat history</h5>
        ${renderLiveStudentRecentMessages(tile.recentMessages)}
      </section>
    `;
  }

  function renderLiveStudentRecentMessages(messages) {
    if (!Array.isArray(messages) || !messages.length) {
      return '<p class="live-student-details-empty">No recent student questions yet.</p>';
    }

    return messages.map((message) => {
      const metaRows = [
        ['Standard', message.standardId],
        ['Topic', message.topic],
        ['Source', titleCaseLabel(message.source) || message.source]
      ].filter(([, value]) => firstText(value));

      return `
        <article class="live-student-message" data-live-student-message>
          ${message.time ? `<time datetime="${escapeAttr(message.time)}">${escapeHtml(formatSessionTime(message.time))}</time>` : ''}
          <div class="live-student-message-bubble student">
            <span>Student</span>
            <p>${escapeHtml(message.question || 'No question text available.')}</p>
          </div>
          <div class="live-student-message-bubble charlemagne">
            <span>Charlemagne</span>
            <p>${escapeHtml(message.response || 'No response yet.')}</p>
          </div>
          ${metaRows.length ? `
            <dl class="live-student-message-meta">
              ${metaRows.map(([label, value]) => `
                <div>
                  <dt>${escapeHtml(label)}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>
              `).join('')}
            </dl>
          ` : ''}
        </article>
      `;
    }).join('');
  }

  async function archiveStudentSession(button) {
    const sessionId = button?.getAttribute('data-archive-student-session') || '';
    if (!sessionId) return;
    const className = cleanRestartSessionBaseName(button?.getAttribute('data-archive-session-class-name') || '');
    const statusId = button?.closest('#reportSessionGroups') ? 'reportExportStatus' : 'profileStudentLinkStatus';

    const confirmed = window.confirm([
      'End Session & Archive?',
      '',
      'This will save this session to CSV.',
      'The session will remain available in Questions & Standards.',
      'Raw JSON history for this session will be deleted after the CSV is verified.',
      'This cannot be undone from the app.'
    ].join('\n'));
    if (!confirmed) return;

    try {
      button.disabled = true;
      setText(statusId, 'Archiving session...');
      const result = await fetchJson(`/api/profile/student-sessions/${encodeURIComponent(sessionId)}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(className ? { confirm: true, className } : { confirm: true })
      });
      const rowCount = Number(result?.rowCount || 0);
      const deletedCount = Number(result?.deletedRecordCount || 0);
      setText(
        statusId,
        result?.message || `Session archived. Rows: ${rowCount}. Deleted raw records: ${deletedCount}.`
      );
      await loadStudentSessions();
      await loadStandardsSummaryReport();
    } catch (error) {
      setText(statusId, error.message || 'Could not archive this session.');
    } finally {
      button.disabled = false;
    }
  }

  async function restartStudentSessionFromReport(button) {
    const sessionKey = button?.getAttribute('data-restart-student-session') || '';
    const sessionClassName = cleanRestartSessionBaseName(button?.getAttribute('data-restart-session-class-name') || '');
    if (!sessionKey) return;

    try {
      button.disabled = true;
      setText('reportExportStatus', 'Restarting session...');
      const result = await fetchJson(`/api/profile/student-sessions/${encodeURIComponent(sessionKey)}/restart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionClassName ? { className: sessionClassName } : {})
      });

      const studentUrl = firstText(result?.studentUrl);
      if (!result?.ok || !studentUrl || !restartSessionLinkMatchesResponse(studentUrl, result)) {
        throw new Error('Restart did not return a joinable student link.');
      }
      const successMessage = restartedSessionStatusMessage(result);
      restartedReportSessions.set(sessionKey, {
        studentUrl,
        className: firstText(result?.className),
        createdAt: firstText(result?.createdAt)
      });
      renderStudentLink(studentUrl);
      setText('reportExportStatus', successMessage);
      setText('profileStudentLinkStatus', successMessage);
      await loadStudentSessions();
      await loadStandardsSummaryReport();
    } catch (error) {
      setText('reportExportStatus', error.message || 'Could not restart this session.');
    } finally {
      button.disabled = false;
    }
  }

  async function copyRestartedReportSessionLink(button) {
    const studentUrl = button?.getAttribute('data-copy-restarted-student-url') || '';
    if (!studentUrl) return;

    try {
      button.disabled = true;
      await copyText(studentUrl);
      setText('reportExportStatus', 'Student link copied.');
      setText('profileStudentLinkStatus', 'Student link copied.');
    } catch {
      setText('reportExportStatus', 'Could not copy student link.');
    } finally {
      button.disabled = false;
    }
  }

  function formatLiveQuestionsLeft(rateLimit) {
    if (!rateLimit || typeof rateLimit !== 'object') return '';
    if (rateLimit.enabled === false) return 'Open';

    const remaining = Number(rateLimit.remainingWhole);
    const max = Number(rateLimit.maxQuestionsPerMinute || rateLimit.max || rateLimit.limit);
    if (!Number.isFinite(remaining) || !Number.isFinite(max) || max <= 0) return '';
    return `${Math.max(0, Math.floor(remaining))}/${Math.floor(max)}`;
  }

  function hasLiveAlert(hub) {
    return liveAlertLabels(hub).length > 0;
  }

  function liveAlertLabels(hub) {
    const alerts = hub?.alerts && typeof hub.alerts === 'object' ? hub.alerts : {};
    const labels = [];
    if (alerts.outOfQuestions) labels.push('Out of questions');
    if (alerts.noMatch) labels.push('No match');
    if (alerts.lowConfidence) labels.push('Low confidence');
    if (alerts.missingStandard) labels.push('Missing standard');
    if (alerts.formulaTutorActive) labels.push('Formula tutor');
    if (alerts.needsReview && !labels.length) labels.push('Needs review');
    return labels;
  }

  function formatHubActivity(hub) {
    const messageCount = Number(hub?.messageCount || 0);
    const noun = messageCount === 1 ? 'message' : 'messages';
    return `${messageCount} ${noun}`;
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

  async function exportReportCsv() {
    const exportButton = byId('reportExportCsv');
    const selectedDate = selectedReportDate();

    if (exportButton) exportButton.disabled = true;
    clearQuestionsStandardsExportState('Exporting CSV from the server...');
    setText('reportExportStatus', 'Exporting CSV from the server...');

    try {
      const response = await fetch(buildQuestionsStandardsExportUrl(selectedDate), { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(await readExportError(response));
      }

      const blob = await response.blob();
      const filename = filenameFromContentDisposition(response.headers.get('Content-Disposition'))
        || `questions-standards-history-${selectedDate}.csv`;
      const exportId = response.headers.get('X-Export-Id');

      downloadBlob(blob, filename);
      if (exportId) {
        questionsStandardsExportState = {
          exportId,
          date: selectedDate,
          filter: reportQuestionFilter
        };
      }
      updateQuestionsStandardsPurgeButton();
      setText(
        'reportExportStatus',
        exportId ? 'CSV exported. Export ID saved for retention.' : 'CSV exported from the server.'
      );
    } catch (error) {
      setText('reportExportStatus', error.message || 'Could not export CSV from the server. No retention export was saved.');
    } finally {
      if (exportButton) exportButton.disabled = currentReportQuestions.length === 0;
    }
  }

  async function purgeQuestionsStandardsExport() {
    const purgeButton = byId('reportPurgeRawHistory');
    const exportId = validQuestionsStandardsExportId();
    if (!exportId) {
      clearQuestionsStandardsExportState('Export the CSV before deleting raw history.');
      return;
    }

    const confirmed = window.confirm([
      'The CSV has already been exported.',
      '',
      'This will delete only the raw JSON history records used to make that CSV.',
      'It will not delete the CSV.',
      'It will not delete problem/question review logs.',
      'It cannot be undone from the app.',
      '',
      'Delete the raw history used for this CSV?'
    ].join('\n'));
    if (!confirmed) return;

    if (purgeButton) purgeButton.disabled = true;
    setText('reportExportStatus', 'Deleting raw history for this export...');

    try {
      const response = await fetch(
        `/api/profile/questions-standards/export/${encodeURIComponent(exportId)}/purge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: true })
        }
      );

      if (!response.ok) {
        throw new Error(await readExportError(response, 'Could not delete raw history for this export.'));
      }

      const data = await response.json().catch(() => ({}));
      const deletedCount = Number(data?.deletedRecordCount || 0);
      questionsStandardsExportState = null;
      updateQuestionsStandardsPurgeButton();
      setText(
        'reportExportStatus',
        `Raw history deleted for this export. Deleted records: ${deletedCount}`
      );
      await loadSummary(selectedReportDate());
      await loadStandardsSummaryReport();
    } catch (error) {
      setText('reportExportStatus', error.message || 'Could not delete raw history for this export.');
      updateQuestionsStandardsPurgeButton();
    }
  }

  function printReport() {
    setText('reportExportStatus', 'Opening print dialog for the current report.');
    window.print();
  }

  async function copyReportSummary() {
    if (!currentReportQuestions.length) {
      setText('reportExportStatus', 'No summary is available to copy yet.');
      return;
    }

    const total = currentReportQuestions.length;
    const matched = currentStandardsTagged || countQuestionsWithStandards(currentReportQuestions);
    const needsReview = currentReportQuestions.filter(questionNeedsReview).length;
    const missing = currentReportQuestions.filter((item) => !hasQuestionStandard(item)).length;
    const generated = currentStandardsSummary?.generatedAt ? formatDateTime(currentStandardsSummary.generatedAt) : 'Not loaded';
    const summary = [
      `Questions & Standards summary for ${currentDate || todayKey()}`,
      `Questions asked: ${total}`,
      `Matched to standards: ${matched}`,
      `Needs review: ${needsReview}`,
      `Missing standard: ${missing}`,
      `Standards report generated: ${generated}`
    ].join('\n');

    try {
      await copyText(summary);
      setText('reportExportStatus', 'Summary copied.');
    } catch {
      setText('reportExportStatus', 'Could not copy summary.');
    }
  }

  function selectedReportDate() {
    return firstDateKey(byId('reportDateSelect')?.value, currentDate, todayKey());
  }

  function buildQuestionsStandardsExportUrl(selectedDate) {
    const params = new URLSearchParams();
    params.set('date', selectedDate || todayKey());
    return `${QUESTIONS_STANDARDS_EXPORT_ENDPOINT}?${params.toString()}`;
  }

  function validQuestionsStandardsExportId() {
    if (!questionsStandardsExportState?.exportId) return '';
    if (questionsStandardsExportState.date !== selectedReportDate()) return '';
    if (questionsStandardsExportState.filter !== reportQuestionFilter) return '';
    return questionsStandardsExportState.exportId;
  }

  function clearQuestionsStandardsExportState(statusMessage = '') {
    questionsStandardsExportState = null;
    updateQuestionsStandardsPurgeButton();
    if (statusMessage) setText('reportExportStatus', statusMessage);
  }

  function updateQuestionsStandardsPurgeButton() {
    const purgeButton = byId('reportPurgeRawHistory');
    if (!purgeButton) return;

    const hasExportId = Boolean(validQuestionsStandardsExportId());
    purgeButton.hidden = !hasExportId;
    purgeButton.disabled = !hasExportId;
  }

  async function readExportError(response, fallbackMessage = 'Could not export CSV from the server. No retention export was saved.') {
    try {
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return data?.error || fallbackMessage;
      }
      const text = await response.text();
      return text.trim() || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  function filenameFromContentDisposition(value) {
    const header = String(value || '');
    const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match) return decodeSafeFilename(utf8Match[1]);
    const quotedMatch = header.match(/filename="([^"]+)"/i);
    if (quotedMatch) return quotedMatch[1];
    const plainMatch = header.match(/filename=([^;]+)/i);
    return plainMatch ? plainMatch[1].trim() : '';
  }

  function decodeSafeFilename(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return String(value || '');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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

  function normalizeKey(value) {
    return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  }

  function firstText(...values) {
    for (const value of values) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text) return text;
    }
    return '';
  }

  function stripRestartedPrefixes(value) {
    let text = firstText(value);
    while (/^Restarted\s+/iu.test(text)) {
      text = text.replace(/^Restarted\s+/iu, '').trim();
    }
    return text;
  }

  function cleanRestartSessionBaseName(value) {
    const cleanName = stripRestartedPrefixes(value);
    return cleanName && !/^session$/iu.test(cleanName) ? cleanName : '';
  }

  function firstCleanRestartSessionBaseName(...values) {
    for (const value of values) {
      const cleanName = cleanRestartSessionBaseName(value);
      if (cleanName) return cleanName;
    }
    return '';
  }

  function normalizeRestartedSessionTitle(value) {
    const cleanName = cleanRestartSessionBaseName(value);
    return cleanName ? (/^Restarted\s+/iu.test(firstText(value)) ? `Restarted ${cleanName}` : cleanName) : 'Restarted Session';
  }

  function restartedSessionStatusMessage(result) {
    const cleanName = firstCleanRestartSessionBaseName(
      result?.sourceSession?.className,
      result?.sourceSession?.sessionLabel,
      result?.className
    );
    return cleanName
      ? `Restarted ${cleanName}. A new student link is ready.`
      : 'Session restarted. A new student link is ready.';
  }

  function restartSessionLinkMatchesResponse(studentUrl, result) {
    const expectedSessionId = firstText(result?.sessionId, result?.classSessionId);
    if (!studentUrl || !expectedSessionId) return false;

    try {
      const parsedUrl = new URL(studentUrl, 'http://localhost');
      const linkedSessionId = firstText(
        parsedUrl.searchParams.get('sessionId'),
        parsedUrl.searchParams.get('classSessionId')
      );
      return linkedSessionId === expectedSessionId;
    } catch {
      return false;
    }
  }

  function titleCaseLabel(value) {
    const text = normalizeKey(value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function topicBucketKey(value) {
    const key = normalizeKey(value);
    if (!key) return '';
    if (key === 'no trusted answer' || key === 'no_match' || key === 'no-match') return 'no match';
    if (key === 'formula' || key === 'science formulas') return 'science formula';
    return key;
  }

  function topicLabelForKey(key) {
    if (key === 'definition') return 'definition';
    if (key === 'science formula') return 'science formula';
    if (key === 'no match') return 'no match';
    return key || 'other';
  }

  function liveSourceLabel(item, topic) {
    const source = firstText(item?.sourceTitle, item?.sourceName, item?.source, item?.routeType, item?.type);
    const topicText = String(topic || '').trim();
    if (source && topicText && normalizeKey(source) !== normalizeKey(topicText)) {
      return `${topicText} / ${titleCaseLabel(source) || source}`;
    }
    return topicText || titleCaseLabel(source) || 'Classroom';
  }

  function isNoMatchQuestion(item) {
    const route = normalizeKey(item?.routeType || item?.type);
    const topic = normalizeKey(item?.topic);
    return route === 'no match' || topic === 'no trusted answer';
  }

  function getFilteredReportQuestions() {
    if (reportQuestionFilter === 'needs-review') return currentReportQuestions.filter(questionNeedsReview);
    if (reportQuestionFilter === 'missing-standard') return currentReportQuestions.filter((item) => !hasQuestionStandard(item));
    return currentReportQuestions;
  }

  function questionNeedsReview(item) {
    if (isNoMatchQuestion(item)) return true;
    if (!hasQuestionStandard(item)) return true;
    if (String(item?.standardsError || '').trim()) return true;
    const confidence = normalizeKey(questionConfidence(item));
    return confidence === 'none' || confidence === 'weak' || confidence === 'low';
  }

  function countQuestionsWithStandards(questions) {
    return (Array.isArray(questions) ? questions : []).filter(hasQuestionStandard).length;
  }

  function hasQuestionStandard(item) {
    return getQuestionStandards(item).length > 0;
  }

  function getQuestionStandards(item) {
    const primary = objectRows(item?.primaryStandards);
    const legacy = objectRows(item?.standards);
    const possible = objectRows(item?.possibleStandards);
    if (primary.length) return primary;
    if (legacy.length) return legacy;
    return possible;
  }

  function formatQuestionStandards(item) {
    const standards = getQuestionStandards(item);
    if (!standards.length) return 'No standard matched';
    return standards
      .map((standard) => [standard.standardId, standard.label].map((part) => String(part || '').trim()).filter(Boolean).join(': '))
      .filter(Boolean)
      .join(', ') || 'Standard matched';
  }

  function renderQuestionStandardsCell(item) {
    const standards = getQuestionStandards(item);
    if (!standards.length) return '<span class="report-standard-empty">No standard matched</span>';

    return standards.map((standard) => {
      const standardId = String(standard?.standardId || '').trim();
      if (!standardId) return '';

      return `
        <button
          type="button"
          class="report-standard-button"
          data-standard-id="${escapeAttr(standardId)}"
          data-standard-bank-id="${escapeAttr(item?.standardsBankId || standard.standardsBankId || '')}"
          data-standard-label="${escapeAttr(standard.label || '')}"
          data-standard-unit="${escapeAttr(standard.unit || '')}"
          data-standard-concept="${escapeAttr(standard.conceptTitle || '')}"
          data-standard-area="${escapeAttr(standard.classroomArea || '')}"
          data-standard-reason="${escapeAttr(standard.reasonSummary || '')}"
          data-standard-domain="${escapeAttr(standard.domainName || standard.domainCode || '')}"
          data-standard-strand="${escapeAttr(standard.strandTitle || standard.strandCode || '')}"
          aria-label="View standard ${escapeAttr(standardId)}"
        >${escapeHtml(standardId)}</button>
      `;
    }).filter(Boolean).join('');
  }

  function standardContextFromButton(button) {
    return {
      standardId: button.getAttribute('data-standard-id') || '',
      standardsBankId: button.getAttribute('data-standard-bank-id') || '',
      label: button.getAttribute('data-standard-label') || '',
      unit: button.getAttribute('data-standard-unit') || '',
      conceptTitle: button.getAttribute('data-standard-concept') || '',
      classroomArea: button.getAttribute('data-standard-area') || '',
      reasonSummary: button.getAttribute('data-standard-reason') || '',
      domain: button.getAttribute('data-standard-domain') || '',
      strand: button.getAttribute('data-standard-strand') || ''
    };
  }

  async function openStandardDetails(context) {
    const standardId = String(context?.standardId || '').trim();
    if (!standardId) return;

    showStandardDetailsModal({
      ...context,
      standardId,
      loading: true
    });

    try {
      const details = await loadStandardDetails(standardId, context?.standardsBankId || '');
      showStandardDetailsModal({
        ...context,
        ...details,
        standardId,
        loading: false
      });
    } catch {
      showStandardDetailsModal({
        ...context,
        standardId,
        loading: false,
        loadError: 'Full standard text is not available yet.'
      });
    }
  }

  async function loadStandardDetails(standardId, standardsBankId = '') {
    const cacheKey = [standardsBankId || 'default', standardId].join(':');
    if (standardDetailsCache.has(cacheKey)) return standardDetailsCache.get(cacheKey);

    const query = standardsBankId ? `?standardsBankId=${encodeURIComponent(standardsBankId)}` : '';
    const data = await fetchJson(`/api/profile/standard-details/${encodeURIComponent(standardId)}${query}`);
    const details = data?.standard && typeof data.standard === 'object' ? data.standard : {};
    standardDetailsCache.set(cacheKey, details);
    return details;
  }

  function showStandardDetailsModal(details) {
    const modal = byId('standardDetailsModal');
    const body = byId('standardDetailsBody');
    const title = byId('standardDetailsTitle');
    if (!modal || !body || !title) return;

    const standardId = String(details?.standardId || '').trim() || 'Unknown standard';
    title.textContent = standardId;
    body.innerHTML = renderStandardDetailsBody(details);
    modal.hidden = false;
    document.body.classList.add('standard-details-open');
    modal.querySelector('.standard-details-panel')?.focus();
  }

  function closeStandardDetailsModal() {
    const modal = byId('standardDetailsModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('standard-details-open');
  }

  function renderStandardDetailsBody(details = {}) {
    if (details.loading) {
      return '<p class="standard-details-fallback">Loading standard details...</p>';
    }

    const standardText = firstText(details.officialStandard, details.officialText, details.standardText, details.statement);
    const studentText = firstText(details.studentFriendlyStandard, details.studentFriendlyText, details.studentCanStatement);
    const fallback = details.loadError || 'Full standard text is not available yet.';
    const metaRows = [
      ['Matched topic', firstText(details.label, details.teacherShortName, details.title)],
      ['Unit', details.unit],
      ['Concept', firstText(details.conceptTitle, details.topic)],
      ['Classroom area', details.classroomArea],
      ['Domain', firstText(details.domainName, details.domain)],
      ['Strand', firstText(details.strandTitle, details.strand)],
      ['Reason', details.reasonSummary]
    ].filter(([, value]) => String(value || '').trim());

    return `
      <div class="standard-details-code">${escapeHtml(details.standardId || 'Unknown standard')}</div>
      <section class="standard-details-section">
        <h5>Standard Text</h5>
        <p>${escapeHtml(standardText || fallback)}</p>
      </section>
      ${studentText ? `
        <section class="standard-details-section">
          <h5>Student-Friendly Text</h5>
          <p>${escapeHtml(studentText)}</p>
        </section>
      ` : ''}
      ${metaRows.length ? `
        <section class="standard-details-section">
          <h5>Related Content</h5>
          <dl class="standard-details-meta">
            ${metaRows.map(([label, value]) => `
              <div>
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `).join('')}
          </dl>
        </section>
      ` : ''}
    `;
  }

  function questionConfidence(item) {
    return item?.standardsConfidence || item?.possibleStandardsConfidence || item?.confidence || 'unknown';
  }

  function reviewStatusForQuestion(item) {
    if (isNoMatchQuestion(item)) return { label: 'Needs review', needsReview: true };
    if (!hasQuestionStandard(item)) return { label: 'Missing standard', needsReview: true };
    if (String(item?.standardsError || '').trim()) return { label: 'Needs review', needsReview: true };

    const confidence = normalizeKey(questionConfidence(item));
    if (confidence === 'none' || confidence === 'weak' || confidence === 'low') {
      return { label: 'Check match', needsReview: true };
    }

    return { label: 'Ready', needsReview: false };
  }

  function formatQuestionTime(item) {
    if (item?.timestamp) return formatDateTime(item.timestamp);
    return [currentDate, item?.time].filter(Boolean).join(' ');
  }

  function formatQuestionTimeParts(item) {
    const timestamp = item?.timestamp ? new Date(item.timestamp) : null;
    if (timestamp && !Number.isNaN(timestamp.getTime())) {
      return {
        date: formatDateKeySlash(timestamp),
        time: timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      };
    }

    return {
      date: formatDateKeySlash(currentDate || todayKey()),
      time: String(item?.time || '').trim()
    };
  }

  function formatDateKeySlash(value) {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    }

    const text = String(value || '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return `${match[1]}/${match[2]}/${match[3]}`;
    return text.replaceAll('-', '/');
  }

  function updateTeacherReportSummary(fallbackMessage = '') {
    if (fallbackMessage && currentReportQuestions.length === 0) {
      setText('reportSummaryStatus', fallbackMessage);
      return;
    }

    const total = currentReportQuestions.length;
    const matched = currentStandardsTagged || countQuestionsWithStandards(currentReportQuestions);
    const needsReview = currentReportQuestions.filter(questionNeedsReview).length;
    const selectedDate = currentDate || todayKey();
    const dateLabel = selectedDate === todayKey() ? 'Today' : `On ${selectedDate}`;
    const reviewPhrase = needsReview === 1 ? '1 question needs teacher review' : `${needsReview} questions need teacher review`;

    if (!total) {
      setText('reportSummaryStatus', 'No questions for this date yet. This report will be ready once classroom activity is logged.');
      return;
    }

    setText(
      'reportSummaryStatus',
      `${dateLabel}, students asked ${total} question${total === 1 ? '' : 's'}. ${matched} question${matched === 1 ? '' : 's'} matched a standard. ${reviewPhrase}. ${needsReview ? 'Review the highlighted rows before export.' : 'This report is ready to export.'}`
    );
  }

  function emptyReportTitle() {
    if (currentReportQuestions.length === 0) return 'No questions yet.';
    if (reportQuestionFilter === 'needs-review') return 'No questions need review.';
    if (reportQuestionFilter === 'missing-standard') return 'No questions are missing standards.';
    return 'No questions match this filter.';
  }

  function emptyReportMessage() {
    if (currentReportQuestions.length === 0) return 'Student questions will appear here after classroom activity is logged.';
    if (reportQuestionFilter === 'needs-review') return 'Everything loaded for this date is ready or already matched.';
    if (reportQuestionFilter === 'missing-standard') return 'Every loaded question has a matched or possible standard.';
    return 'Try another date or filter.';
  }

  function updateReportFilterButtons() {
    document.querySelectorAll('[data-report-filter]').forEach((button) => {
      const active = button.getAttribute('data-report-filter') === reportQuestionFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function updateExportButtonStates(questions) {
    const hasRows = Array.isArray(questions) && questions.length > 0;
    const csvButton = byId('reportExportCsv');
    const copyButton = byId('reportCopySummary');
    if (csvButton) csvButton.disabled = !hasRows;
    if (copyButton) copyButton.disabled = currentReportQuestions.length === 0;
  }

  function confidenceLabel(value) {
    const confidence = normalizeKey(value);
    if (confidence === 'strong' || confidence === 'high') return 'Strong';
    if (confidence === 'weak' || confidence === 'low') return 'Weak';
    if (confidence === 'none' || confidence === 'no confidence') return 'None';
    if (confidence === 'unknown') return 'Unknown';
    return 'Medium';
  }

  function confidenceClass(value) {
    return confidenceLabel(value).toLowerCase();
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
      availableDates: Array.isArray(summary?.availableDates) ? summary.availableDates.filter(Boolean) : [],
      questions: objectRows(summary?.questions),
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

  function firstDateKey(...values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      if (text.toLowerCase() === 'today') return todayKey();
    }
    return todayKey();
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
    if (['modes', 'live-activity', 'reports'].includes(event.detail?.id)) {
      refreshActiveProfileBlade();
    }
  });
  setTimeout(init, 250);
  setTimeout(init, 1000);

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
