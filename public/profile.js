(function () {
  let initialized = false;
  let currentDate = '';
  let currentProfileStatus = null;
  let currentStudentUrl = '';
  let currentStandardsTagged = 0;
  let currentStandardsSummary = null;
  let currentQuestions = [];
  let reportQuestionFilter = 'all';
  const standardDetailsCache = new Map();
  let showingReviewQuestions = false;
  let studentSessionRefreshTimer = null;
  let loadingStudentControls = false;

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
  }

  async function saveStudentControls() {
    if (loadingStudentControls) return;

    const copyLock = byId('studentCopyInspectLockEnabled');
    const guidedFormulaTutor = byId('studentGuidedFormulaTutoringEnabled');
    const rateLimit = byId('studentQuestionRateLimitEnabled');
    const perMinute = byId('studentQuestionsPerMinute');
    const questionsPerMinute = Number(perMinute?.value || 6);

    if (!Number.isInteger(questionsPerMinute) || questionsPerMinute < 1 || questionsPerMinute > 30) {
      setText('studentControlsStatus', 'Questions per minute must be from 1 to 30.');
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
      const selectedDate = preferredDate || select.value || currentDate || data.defaultDate || todayKey();
      currentDate = dates.includes(selectedDate) ? selectedDate : dates[0] || data.defaultDate || selectedDate;

      select.innerHTML = dates.length
        ? dates.map((date) => `<option value="${escapeAttr(date)}">${escapeHtml(date)}</option>`).join('')
        : `<option value="${escapeAttr(currentDate)}">${escapeHtml(currentDate)}</option>`;
      select.value = currentDate;
      select.disabled = false;
      syncReportDateSelect(dates, currentDate);

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
    const noMatchCount = questions.filter(isNoMatchQuestion).length;
    const reviewCount = questions.filter(questionNeedsReview).length;
    const matchedToStandards = countQuestionsWithStandards(questions);
    const topTopic = topics[0]?.topic ? titleCaseLabel(topics[0].topic) : '-';
    const untaggedQuestions = Math.max(0, total - currentStandardsTagged);

    setText('profileTotalQuestions', total);
    setText('reportQuestionsAskedValue', total);
    setText('profileNeedsReviewValue', noMatchCount);
    setText('profileTopTopicValue', topTopic);
    setText('profileStandardsTaggedValue', currentStandardsTagged);
    setText('liveStandardsTaggedValue', currentStandardsTagged);
    setText('reportStandardsTaggedValue', currentStandardsTagged || matchedToStandards);
    setText('reportUntaggedQuestionsValue', untaggedQuestions);
    setText('reportTopTopicValue', topTopic);
    setText('reportNeedsReviewValue', reviewCount);
    setText('reportDateRangeValue', data.date || currentDate || todayKey());
    setAttentionCount('profileNeedsReviewValue', noMatchCount);
    setAttentionCount('reportNeedsReviewValue', reviewCount);
    setText(
      'profileNoMatchAttention',
      `${noMatchCount} no-match question${noMatchCount === 1 ? '' : 's'} need${noMatchCount === 1 ? 's' : ''} review`
    );
    setText(
      'profileMissingStandardsAttention',
      `${Math.max(0, total - currentStandardsTagged)} question${Math.max(0, total - currentStandardsTagged) === 1 ? '' : 's'} missing standards tags`
    );
    setText('profileCommonTopicAttention', `Most common topic: ${topTopic === '-' ? 'none yet' : topTopic.toLowerCase()}`);
    setText(
      'profileSummaryStatus',
      total ? `Showing activity for ${data.date || currentDate}.` : 'No question activity loaded yet.'
    );
    setText(
      'profileDailySummaryText',
      total
        ? `${total} question${total === 1 ? '' : 's'} on ${data.date || currentDate}; top topic is ${topTopic === '-' ? 'none yet' : topTopic}.`
        : 'No question activity was logged for this date yet.'
    );

    currentQuestions = questions;
    showingReviewQuestions = false;
    updateTeacherReportSummary();
    renderQuestionRows(currentQuestions);
    renderReportQuestionRows(getFilteredReportQuestions());
    renderTopicSummary(topics);
  }

  function renderSummaryError(message) {
    setText('profileTotalQuestions', 0);
    setText('reportQuestionsAskedValue', 0);
    setText('profileNeedsReviewValue', 0);
    setText('profileTopTopicValue', '-');
    setText('profileStandardsTaggedValue', currentStandardsTagged);
    setText('liveStandardsTaggedValue', currentStandardsTagged);
    setText('reportStandardsTaggedValue', currentStandardsTagged);
    setText('reportUntaggedQuestionsValue', 0);
    setText('reportTopTopicValue', '-');
    setText('reportNeedsReviewValue', 0);
    setText('reportDateRangeValue', currentDate || todayKey());
    setAttentionCount('profileNeedsReviewValue', 0);
    setAttentionCount('reportNeedsReviewValue', 0);
    setText('profileNoMatchAttention', '0 no-match questions need review');
    setText('profileMissingStandardsAttention', '0 questions missing standards tags');
    setText('profileCommonTopicAttention', 'Most common topic: none yet');
    setText('profileSummaryStatus', message);
    setText('profileDailySummaryText', message);
    currentQuestions = [];
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
    setText('liveStandardsTaggedValue', tagged);
    setText('reportStandardsTaggedValue', tagged);
    setText('reportUntaggedQuestionsValue', safeSummary.untaggedQuestions);
    setText('reportDateRangeValue', currentDate || byId('reportDateSelect')?.value || todayKey());
    updateTeacherReportSummary();
    const coverageDonut = byId('standardsCoverageDonut');
    if (coverageDonut) coverageDonut.style.setProperty('--coverage-percent', String(Math.max(0, Math.min(100, percentTagged))));
    const liveTotal = Number(byId('profileTotalQuestions')?.textContent || 0);
    const missingLiveStandards = Math.max(0, liveTotal - tagged);
    setText(
      'profileMissingStandardsAttention',
      `${missingLiveStandards} question${missingLiveStandards === 1 ? '' : 's'} missing standards tags`
    );

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
      rows.innerHTML = `<p class="profile-empty-state" role="row">${
        showingReviewQuestions ? 'No review-needed questions found for this date.' : 'No question activity loaded yet.'
      }</p>`;
      renderReportQuestionRows(getFilteredReportQuestions());
      return;
    }

    rows.innerHTML = questions.map((item) => `
      <div class="profile-table-row ${isNoMatchQuestion(item) ? 'needs-review-row' : ''}" role="row">
        <span role="cell">${escapeHtml(item.time || '')}</span>
        <span role="cell">${escapeHtml(titleCaseLabel(item.topic || 'other'))}</span>
        <span role="cell" title="${escapeAttr(item.question || '')}">${escapeHtml(truncate(item.question, 130))}</span>
        <span role="cell"><span class="live-status-pill ${isNoMatchQuestion(item) ? 'no-match' : 'matched'}">${escapeHtml(statusLabel(item))}</span></span>
        <span role="cell"><span class="live-confidence-pill ${confidenceClass(item.confidence)}">${escapeHtml(confidenceLabel(item.confidence))}</span></span>
      </div>
    `).join('');
    renderReportQuestionRows(getFilteredReportQuestions());
  }

  function renderReportQuestionRows(questions) {
    const rows = byId('reportQuestionRows');
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

  function updateReportQuestionCount(questions) {
    const visible = Array.isArray(questions) ? questions.length : 0;
    const total = Array.isArray(currentQuestions) ? currentQuestions.length : 0;
    setText('reportQuestionCount', `Showing ${visible} of ${total}`);
  }

  function reviewQuestions() {
    const reviewQuestions = currentQuestions.filter(isNoMatchQuestion);
    const table = byId('profileQuestionRows');

    showingReviewQuestions = true;
    renderQuestionRows(reviewQuestions);

    if (reviewQuestions.length) {
      setText(
        'profileSummaryStatus',
        `Showing ${reviewQuestions.length} no-match question${reviewQuestions.length === 1 ? '' : 's'} that need review.`
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
      await loadStandardsSummaryReport();
    });

    byId('reportDateSelect')?.addEventListener('change', async (event) => {
      syncDateSelectValue(event.target.value);
      await loadSummary(event.target.value);
      await loadStandardsSummaryReport();
    });

    byId('profileRefreshSummary')?.addEventListener('click', async () => {
      await loadProfileStatus();
      await loadDates(byId('profileDateSelect')?.value || currentDate);
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
        renderReportQuestionRows(getFilteredReportQuestions());
      });
    });

    byId('reportQuestionRows')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-standard-id]');
      if (!button) return;
      openStandardDetails(standardContextFromButton(button));
    });

    byId('standardDetailsModal')?.addEventListener('click', (event) => {
      if (event.target.closest('[data-standard-modal-close]')) closeStandardDetailsModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !byId('standardDetailsModal')?.hidden) {
        closeStandardDetailsModal();
      }
    });

    byId('reportExportCsv')?.addEventListener('click', exportReportCsv);
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
    select.innerHTML = safeDates.length
      ? safeDates.map((date) => `<option value="${escapeAttr(date)}">${escapeHtml(date)}</option>`).join('')
      : `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`;
    select.value = value;
    select.disabled = false;
  }

  function syncDateSelectValue(value) {
    currentDate = value || currentDate || todayKey();
    const profileSelect = byId('profileDateSelect');
    const reportSelect = byId('reportDateSelect');
    if (profileSelect && profileSelect.value !== currentDate) profileSelect.value = currentDate;
    if (reportSelect && reportSelect.value !== currentDate) reportSelect.value = currentDate;
    setText('reportDateRangeValue', currentDate);
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
      studentUrl ? 'Class link ready. Copy and share this one link with students.' : 'No class link created yet.'
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
    if (!rows) return;

    if (errorMessage) {
      setText('profileStudentSessionCount', 'Unavailable');
      rows.innerHTML = `<p class="profile-empty-state">${escapeHtml(errorMessage)}</p>`;
      return;
    }

    if (!sessions.length) {
      setText('profileStudentSessionCount', '0 active');
      rows.innerHTML = '<p class="profile-empty-state">Create a class link to start anonymous student hubs.</p>';
      if (!currentStudentUrl) renderStudentLink('');
      return;
    }

    const activeSession = sessions[0] || {};
    const studentUrl = activeSession.studentUrl || '';
    if (studentUrl && !currentStudentUrl) renderStudentLink(studentUrl);

    const hubs = Array.isArray(activeSession.anonymousHubs) ? activeSession.anonymousHubs : [];
    const activeCount = Number(activeSession.activeAnonymousHubCount ?? hubs.length) || 0;
    setText('profileStudentSessionCount', `${activeCount} active`);

    if (!hubs.length) {
      rows.innerHTML = `
        <div class="profile-student-session-row is-class-session">
          <div>
            <strong>Class link status</strong>
            <span>Waiting for anonymous student hubs.</span>
          </div>
          <time datetime="${escapeAttr(activeSession.createdAt || '')}">${escapeHtml(formatSessionTime(activeSession.createdAt))}</time>
        </div>
      `;
      return;
    }

    rows.innerHTML = hubs.slice(0, 3).map((hub, index) => `
      <div class="profile-student-session-row">
        <div>
          <strong>${escapeHtml(hub.label || `Anonymous Student ${index + 1}`)}</strong>
          <span>${escapeHtml(formatHubActivity(hub))}</span>
          ${hub.studentHubId ? `
            <details class="profile-student-debug">
              <summary>Technical</summary>
              <code>${escapeHtml(hub.studentHubId)}</code>
            </details>
          ` : ''}
        </div>
        <time datetime="${escapeAttr(hub.lastSeenAt || '')}">${escapeHtml(formatSessionTime(hub.lastSeenAt))}</time>
      </div>
    `).join('');
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

  function exportReportCsv() {
    const rows = getFilteredReportQuestions();
    if (!rows.length) {
      setText('reportExportStatus', 'No rows are available to export for this filter.');
      return;
    }

    const csvRows = [
      ['Time/date', 'Question', 'Topic', 'Standard'],
      ...rows.map((item) => {
        const timeParts = formatQuestionTimeParts(item);
        return [
          [timeParts.date, timeParts.time].filter(Boolean).join(' '),
          item.question || '',
          titleCaseLabel(item.topic || 'other') || 'Other',
          formatQuestionStandards(item)
        ];
      })
    ];
    const csv = csvRows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions-standards-${currentDate || todayKey()}-${reportQuestionFilter}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setText('reportExportStatus', `CSV exported for ${rows.length} row${rows.length === 1 ? '' : 's'}.`);
  }

  function printReport() {
    setText('reportExportStatus', 'Opening print dialog for the current report.');
    window.print();
  }

  async function copyReportSummary() {
    if (!currentQuestions.length) {
      setText('reportExportStatus', 'No summary is available to copy yet.');
      return;
    }

    const total = currentQuestions.length;
    const matched = currentStandardsTagged || countQuestionsWithStandards(currentQuestions);
    const needsReview = currentQuestions.filter(questionNeedsReview).length;
    const missing = currentQuestions.filter((item) => !hasQuestionStandard(item)).length;
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

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
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

  function isNoMatchQuestion(item) {
    const route = normalizeKey(item?.routeType || item?.type);
    const topic = normalizeKey(item?.topic);
    return route === 'no match' || topic === 'no trusted answer';
  }

  function getFilteredReportQuestions() {
    if (reportQuestionFilter === 'needs-review') return currentQuestions.filter(questionNeedsReview);
    if (reportQuestionFilter === 'missing-standard') return currentQuestions.filter((item) => !hasQuestionStandard(item));
    return currentQuestions;
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
    if (fallbackMessage && currentQuestions.length === 0) {
      setText('reportSummaryStatus', fallbackMessage);
      return;
    }

    const total = currentQuestions.length;
    const matched = currentStandardsTagged || countQuestionsWithStandards(currentQuestions);
    const needsReview = currentQuestions.filter(questionNeedsReview).length;
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
    if (currentQuestions.length === 0) return 'No questions yet.';
    if (reportQuestionFilter === 'needs-review') return 'No questions need review.';
    if (reportQuestionFilter === 'missing-standard') return 'No questions are missing standards.';
    return 'No questions match this filter.';
  }

  function emptyReportMessage() {
    if (currentQuestions.length === 0) return 'Student questions will appear here after classroom activity is logged.';
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
    if (copyButton) copyButton.disabled = currentQuestions.length === 0;
  }

  function statusLabel(item) {
    return isNoMatchQuestion(item) ? 'No Match' : 'Matched';
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
    if (['modes', 'live-activity', 'reports'].includes(event.detail?.id)) {
      refreshActiveProfileBlade();
    }
  });
  setTimeout(init, 250);
  setTimeout(init, 1000);

  const observer = new MutationObserver(init);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
