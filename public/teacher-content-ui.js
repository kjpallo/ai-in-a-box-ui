(() => {
  const ENDPOINTS = {
    dashboard: '/api/teacher-content/dashboard',
    drafts: '/api/teacher-content/drafts',
    draftReport: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/report`,
    draftItem: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}`,
    draftItemStatus: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status`,
    approved: '/api/teacher-content/approved'
  };

  const TABS = [
    { id: 'upload', label: 'Upload' },
    { id: 'standards', label: 'Standards' },
    { id: 'draftPack', label: 'Draft Pack' },
    { id: 'review', label: 'Review' },
    { id: 'importReport', label: 'Import Report' },
    { id: 'approvedPacks', label: 'Approved Packs' }
  ];

  const SECTION_LABELS = {
    vocabulary: 'Vocabulary',
    concepts: 'Concepts',
    referenceFormulas: 'Reference Formulas',
    problemBank: 'Problem Bank',
    standardsMap: 'Standards Map',
    smokeTests: 'Smoke Tests'
  };

  const EDITABLE_FIELDS = {
    vocabulary: ['studentDefinition', 'teacherDefinition', 'misconception'],
    concepts: ['studentExplanation', 'keyIdeas'],
    referenceFormulas: ['equation'],
    problemBank: ['expectedAnswer'],
    standardsMap: ['standardId'],
    smokeTests: ['expectedAnswer']
  };

  const state = {
    initialized: false,
    loadedOnce: false,
    loading: false,
    activeTab: 'upload',
    selectedDraftPackId: '',
    dashboard: null,
    drafts: [],
    approved: [],
    approvedIndexedCounts: null,
    approvedSearchableCounts: null,
    report: null,
    selectedReviewItem: null,
    reviewActionLoading: false,
    errors: []
  };

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

  async function fetchJson(url, options) {
    return window.Charlemagne.api.fetchJson(url, options);
  }

  function unwrap(payload) {
    return payload && payload.success === true && payload.data ? payload.data : payload;
  }

  function buildOverlay() {
    if (byId('teacherContentOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'teacherContentOverlay';
    overlay.className = 'teacher-content-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="teacher-content-scrim" data-teacher-content-close></div>
      <section class="teacher-content-blade" role="dialog" aria-modal="true" aria-labelledby="teacherContentTitle">
        <div class="teacher-content-head">
          <div>
            <span class="profile-status-pill">Teacher Content</span>
            <h3 id="teacherContentTitle">Create New Knowledge</h3>
            <p>Review uploaded knowledge drafts, import reports, and approved pack summaries.</p>
          </div>
          <button type="button" id="teacherContentClose" class="teacher-content-close" aria-label="Close Teacher Content" data-teacher-content-close>×</button>
        </div>

        <div class="teacher-content-status-row">
          <span id="teacherContentLoadStatus">Ready to load teacher content.</span>
          <label class="teacher-content-draft-picker" for="teacherContentDraftSelect">
            <span>Draft</span>
            <select id="teacherContentDraftSelect"></select>
          </label>
        </div>

        <nav id="teacherContentTabs" class="teacher-content-tabs" aria-label="Teacher Content cards"></nav>
        <div id="teacherContentDeck" class="teacher-content-deck"></div>

        <div class="teacher-content-footer">
          <button type="button" id="teacherContentBack" class="small-button secondary-small">Back</button>
          <span id="teacherContentStepLabel">Upload</span>
          <button type="button" id="teacherContentNext" class="small-button">Next</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);
  }

  function init() {
    if (state.initialized) return;
    if (!window.Charlemagne?.api?.fetchJson) return;

    state.initialized = true;
    buildOverlay();
    bindEvents();
    render();
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const openButton = event.target.closest('#openTeacherContentOverlay');
      if (openButton) {
        event.preventDefault();
        openOverlay();
        return;
      }

      if (event.target.closest('[data-teacher-content-close]')) {
        event.preventDefault();
        closeOverlay();
        return;
      }

      const tab = event.target.closest('[data-teacher-content-tab]');
      if (tab) {
        event.preventDefault();
        setActiveTab(tab.getAttribute('data-teacher-content-tab'));
        return;
      }

      const reviewEdit = event.target.closest('[data-review-edit]');
      if (reviewEdit) {
        event.preventDefault();
        openReviewItem(reviewEdit);
        return;
      }

      const reviewStatus = event.target.closest('[data-review-status]');
      if (reviewStatus) {
        event.preventDefault();
        updateReviewStatusFromButton(reviewStatus);
        return;
      }

      const reviewClose = event.target.closest('[data-review-close]');
      if (reviewClose) {
        event.preventDefault();
        closeReviewItem();
        return;
      }

      const reviewSave = event.target.closest('[data-review-save]');
      if (reviewSave) {
        event.preventDefault();
        saveReviewEdits();
      }
    });

    byId('teacherContentBack')?.addEventListener('click', () => shiftTab(-1));
    byId('teacherContentNext')?.addEventListener('click', () => shiftTab(1));
    byId('teacherContentDraftSelect')?.addEventListener('change', async (event) => {
      state.selectedDraftPackId = event.target.value || '';
      state.selectedReviewItem = null;
      await loadSelectedDraftReport();
      render();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOverlayOpen()) closeOverlay();
    });
  }

  async function openOverlay() {
    const overlay = byId('teacherContentOverlay');
    if (!overlay) return;

    overlay.hidden = false;
    document.body.classList.add('teacher-content-open');
    byId('teacherContentClose')?.focus();

    if (!state.loadedOnce) {
      await loadTeacherContent();
    } else {
      render();
    }
  }

  function closeOverlay() {
    const overlay = byId('teacherContentOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('teacher-content-open');
    byId('openTeacherContentOverlay')?.focus();
  }

  function isOverlayOpen() {
    const overlay = byId('teacherContentOverlay');
    return Boolean(overlay && !overlay.hidden);
  }

  async function loadTeacherContent() {
    state.loading = true;
    state.errors = [];
    setStatus('Loading teacher content...');
    render();

    const [dashboardResult, draftsResult, approvedResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.approved)
    ]);

    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(approvedResult, 'approved');

    if (!state.selectedDraftPackId && state.drafts.length) {
      state.selectedDraftPackId = state.drafts[0].packId || '';
    }

    await loadSelectedDraftReport();

    state.loading = false;
    state.loadedOnce = true;
    render();
  }

  function applySettledResult(result, kind) {
    if (result.status !== 'fulfilled') {
      state.errors.push(`${titleCase(kind)} failed to load: ${result.reason?.message || 'Route error'}`);
      return;
    }

    const data = unwrap(result.value);
    if (kind === 'dashboard') {
      state.dashboard = data || null;
      collectApiIssues(data);
      return;
    }

    if (kind === 'drafts') {
      state.drafts = Array.isArray(data?.draftPacks) ? data.draftPacks : [];
      collectApiIssues(data);
      return;
    }

    state.approved = Array.isArray(data?.approvedPacks) ? data.approvedPacks : [];
    state.approvedIndexedCounts = data?.indexedCounts || null;
    state.approvedSearchableCounts = data?.searchableCounts || null;
    collectApiIssues(data);
  }

  async function loadSelectedDraftReport() {
    state.report = null;
    if (!state.selectedDraftPackId) return;

    try {
      const data = unwrap(await fetchJson(ENDPOINTS.draftReport(state.selectedDraftPackId)));
      state.report = data || null;
      reconcileSelectedReviewItem();
      collectApiIssues(data);
    } catch (error) {
      state.errors.push(`Draft report failed to load: ${error.message || 'Route error'}`);
    }
  }

  function collectApiIssues(data) {
    const warnings = Array.isArray(data?.warnings) ? data.warnings : [];
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    errors.forEach((item) => {
      if (typeof item === 'string') {
        state.errors.push(item);
      } else if (Array.isArray(item?.errors)) {
        state.errors.push(...item.errors);
      }
    });
    warnings.forEach((item) => {
      if (typeof item === 'string') state.errors.push(`Warning: ${item}`);
    });
  }

  function render() {
    renderTabs();
    renderDraftSelect();
    renderDeck();
    renderFooter();
    renderStatus();
  }

  function renderTabs() {
    const tabs = byId('teacherContentTabs');
    if (!tabs) return;

    tabs.innerHTML = TABS.map((tab, index) => `
      <button
        type="button"
        class="teacher-content-tab ${tab.id === state.activeTab ? 'active' : ''}"
        data-teacher-content-tab="${escapeAttr(tab.id)}"
        aria-selected="${tab.id === state.activeTab ? 'true' : 'false'}"
      >
        <span>${index + 1}</span>
        ${escapeHtml(tab.label)}
      </button>
    `).join('');
  }

  function renderDraftSelect() {
    const select = byId('teacherContentDraftSelect');
    if (!select) return;

    if (!state.drafts.length) {
      select.innerHTML = '<option value="">No draft packs</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = state.drafts.map((draft) => `
      <option value="${escapeAttr(draft.packId)}">${escapeHtml(draft.title || draft.packId)}</option>
    `).join('');
    select.value = state.selectedDraftPackId || state.drafts[0].packId || '';
  }

  function renderDeck() {
    const deck = byId('teacherContentDeck');
    if (!deck) return;

    deck.innerHTML = TABS.map((tab, index) => `
      <article
        class="teacher-content-card ${tab.id === state.activeTab ? 'active' : ''}"
        data-teacher-content-card="${escapeAttr(tab.id)}"
        style="--card-depth: ${index}"
      >
        ${renderCard(tab.id)}
      </article>
    `).join('');
  }

  function renderCard(tabId) {
    if (state.loading) {
      return `
        <div class="teacher-content-card-head">
          <h4>${escapeHtml(tabLabel(tabId))}</h4>
          <span class="teacher-content-pill">Loading</span>
        </div>
        <p class="profile-empty-state">Loading read-only teacher content data...</p>
      `;
    }

    if (tabId === 'upload') return renderUploadCard();
    if (tabId === 'standards') return renderStandardsCard();
    if (tabId === 'draftPack') return renderDraftPackCard();
    if (tabId === 'review') return renderReviewCard();
    if (tabId === 'importReport') return renderImportReportCard();
    return renderApprovedPacksCard();
  }

  function renderUploadCard() {
    const extraction = state.report?.sourceExtraction || {};
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Create New Knowledge</h4>
          <p>Upload processing is coming soon. This card only previews the future flow.</p>
        </div>
        <span class="teacher-content-pill muted">Coming Soon</span>
      </div>
      <div class="teacher-content-upload-row">
        <button type="button" class="small-button" disabled data-coming-soon="upload-browse">Browse</button>
        <div class="teacher-content-file-placeholder" data-selected-file>
          ${escapeHtml(extraction.fileName || 'No file selected')}
        </div>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="upload-process">Process / Proceed</button>
      </div>
      <div class="teacher-content-metric-grid">
        ${metric('File Type', extraction.fileType || 'Not selected')}
        ${metric('Extraction Status', passFail(extraction.success))}
        ${metric('Character Count', formatNumber(extraction.characterCount))}
        ${metric('Sections Found', formatNumber(extraction.sectionsFound))}
        ${metric('Tables Found', formatNumber(extraction.tablesFound))}
      </div>
      ${renderIssueList('Warnings', extraction.warnings)}
      ${renderIssueList('Errors', extraction.errors)}
    `;
  }

  function renderStandardsCard() {
    const summary = state.report?.standardsSummary || null;
    if (!state.selectedDraftPackId) {
      return cardWithEmptyState('Standards', 'No draft/report is selected yet.');
    }

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Standards</h4>
          <p>Standards controls are placeholders for the future import flow.</p>
        </div>
        <span class="teacher-content-pill muted">Read Only</span>
      </div>
      <div class="teacher-content-upload-row">
        <select disabled data-coming-soon="standards-select">
          <option>Select standards bank - coming soon</option>
        </select>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-upload">Upload standards</button>
      </div>
      <div class="teacher-content-metric-grid">
        ${metric('Standards Map Count', formatNumber(summary?.standardsMapCount))}
        ${metric('Standard IDs Used', formatNumber(summary?.standardIds?.length))}
        ${metric('Unknown Standards', formatNumber(summary?.unknown?.length))}
        ${metric('Missing Standards', formatNumber(summary?.missing?.length))}
      </div>
      ${renderChipList('Standard IDs', summary?.standardIds)}
      ${renderChipList('Unknown / Missing', [...(summary?.unknown || []), ...(summary?.missing || [])])}
    `;
  }

  function renderDraftPackCard() {
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    if (!draft || !state.selectedDraftPackId) {
      return cardWithEmptyState('Draft Pack', 'No draft packs are available yet.');
    }

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>${escapeHtml(draft.title || 'Untitled draft pack')}</h4>
          <p>${escapeHtml(draft.subject || 'No subject')} · Grade ${escapeHtml(draft.gradeLevel || 'not set')}</p>
        </div>
        <span class="teacher-content-pill ${draft.validationPassed === false ? 'blocked' : 'ready'}">
          ${draft.validationPassed === false ? 'Validation failed' : 'Validation passed'}
        </span>
      </div>
      <div class="teacher-content-detail-grid">
        ${metric('Pack ID', draft.packId || state.selectedDraftPackId)}
        ${metric('Subject', draft.subject || 'Not set')}
        ${metric('Grade Level', draft.gradeLevel || 'Not set')}
        ${metric('Version', draft.version || 'Not set')}
      </div>
      ${renderCounts('Item Counts', draft.itemCounts)}
      ${renderCounts('Review Counts', draft.reviewCounts)}
    `;
  }

  function renderReviewCard() {
    const pending = state.report?.pendingReview;
    if (!state.selectedDraftPackId) {
      return cardWithEmptyState('Review', 'No draft/report is selected yet.');
    }

    if (state.reviewActionLoading) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Review Draft</h4>
            <p>Saving draft-only review change...</p>
          </div>
          <span class="teacher-content-pill review">Saving</span>
        </div>
        <p class="profile-empty-state">Refreshing the selected draft report.</p>
      `;
    }

    if (!pending || pending.totalPending === 0) {
      return `
        ${cardWithEmptyState('Review', 'No pending review items for this draft pack.')}
        ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
      `;
    }

    const groups = pending.items || {};
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Pending Review</h4>
          <p>${formatNumber(pending.totalPending)} item${Number(pending.totalPending) === 1 ? '' : 's'} waiting for teacher review.</p>
        </div>
        <span class="teacher-content-pill review">Draft Only</span>
      </div>
      ${state.errors.length ? renderIssueList('Review Messages', state.errors) : ''}
      <div class="teacher-content-review-groups">
        ${Object.keys(SECTION_LABELS).map((sectionName) => renderReviewGroup(sectionName, groups[sectionName] || [])).join('')}
      </div>
      ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
    `;
  }

  function renderReviewGroup(sectionName, items) {
    return `
      <section class="teacher-content-review-group">
        <div class="teacher-content-review-group-head">
          <h5>${escapeHtml(SECTION_LABELS[sectionName])}</h5>
          <span>${formatNumber(items.length)}</span>
        </div>
        ${items.length ? items.map(renderPendingItem).join('') : '<p class="profile-empty-state">No pending items.</p>'}
      </section>
    `;
  }

  function renderPendingItem(item) {
    return `
      <div class="teacher-content-review-item">
        <div>
          <strong>${escapeHtml(item.label || 'Pending item')}</strong>
          <span>Confidence: ${escapeHtml(item.confidence || 'Not set')}</span>
          <span>${escapeHtml(item.sourceFile || 'No source file')} · ${escapeHtml(item.sourceLocation || 'No source location')}</span>
          <span>Status: ${escapeHtml(item.reviewStatus || 'pending')}</span>
        </div>
        <p>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        <div class="teacher-content-review-actions">
          <button type="button" class="small-button secondary-small" data-review-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">View/Edit</button>
          <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Approve</button>
          <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Reject</button>
        </div>
      </div>
    `;
  }

  function renderReviewDetailPanel(item) {
    const editableFields = EDITABLE_FIELDS[item.section] || [];
    return `
      <section class="teacher-content-review-detail" data-review-detail>
        <div class="teacher-content-card-head">
          <div>
            <h4>${escapeHtml(item.label || 'Review item')}</h4>
            <p>${escapeHtml(SECTION_LABELS[item.section] || item.section)} · index ${escapeHtml(item.index)}</p>
          </div>
          <span class="teacher-content-pill review">${escapeHtml(item.reviewStatus || 'pending')}</span>
        </div>
        <div class="teacher-content-detail-grid">
          ${metric('Section', SECTION_LABELS[item.section] || item.section)}
          ${metric('Index', item.index)}
          ${metric('Confidence', item.confidence || 'Not set')}
          ${metric('Source', `${item.sourceFile || 'No source file'} · ${item.sourceLocation || 'No source location'}`)}
        </div>
        <section class="teacher-content-issues">
          <h5>Source Snippet</h5>
          <p>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        </section>
        <div class="teacher-content-edit-fields">
          ${editableFields.map((fieldName) => renderEditableField(fieldName, item.editableFields?.[fieldName])).join('')}
        </div>
        <div class="teacher-content-review-detail-actions">
          <button type="button" class="small-button" data-review-save>Save</button>
          <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Approve</button>
          <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Reject</button>
          <button type="button" class="small-button secondary-small" data-review-close>Cancel</button>
        </div>
      </section>
    `;
  }

  function renderEditableField(fieldName, value) {
    const stringValue = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
    return `
      <label class="teacher-content-edit-field">
        <span>${escapeHtml(titleCase(fieldName))}</span>
        <textarea rows="3" data-review-field="${escapeAttr(fieldName)}">${escapeHtml(stringValue)}</textarea>
      </label>
    `;
  }

  function renderImportReportCard() {
    if (!state.selectedDraftPackId) {
      return cardWithEmptyState('Import Report', 'No draft/report is selected yet.');
    }

    const extraction = state.report?.sourceExtraction || {};
    const draft = state.report?.draftPack || {};
    const readiness = state.report?.promotionReadiness || {};
    const status = readiness.ready ? 'Ready to promote' : readiness.blockedReasons?.length ? 'Blocked' : 'Needs teacher review';
    const statusClass = readiness.ready ? 'ready' : status === 'Blocked' ? 'blocked' : 'review';

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Import Report</h4>
          <p>Promotion controls are intentionally not present in Phase 7A.</p>
        </div>
        <span class="teacher-content-pill ${statusClass}">${escapeHtml(status)}</span>
      </div>
      <div class="teacher-content-metric-grid">
        ${metric('Extraction', passFail(extraction.success))}
        ${metric('Draft Validation', passFail(draft.validationPassed))}
        ${metric('Promotion Readiness', status)}
      </div>
      ${renderIssueList('Blocked Reasons', readiness.blockedReasons)}
      ${renderIssueList('Warnings', state.report?.warnings)}
      ${renderIssueList('Errors', state.report?.errors)}
    `;
  }

  function renderApprovedPacksCard() {
    if (!state.approved.length) {
      return cardWithEmptyState('Approved Packs', 'No approved packs are available yet.');
    }

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Approved Packs</h4>
          <p>Switches are visual placeholders only. Packs are not enabled or disabled from this UI.</p>
        </div>
        <span class="teacher-content-pill muted">Visual Only</span>
      </div>
      <div class="teacher-content-approved-list">
        ${state.approved.map(renderApprovedPack).join('')}
      </div>
      ${renderCounts('Indexed / Searchable Counts', state.approvedIndexedCounts || state.approvedSearchableCounts)}
    `;
  }

  function renderApprovedPack(pack) {
    const counts = pack.itemCounts || {};
    const indexed = pack.indexedCounts || {};
    return `
      <section class="teacher-content-approved-pack">
        <div class="teacher-content-approved-head">
          <div>
            <strong>${escapeHtml(pack.title || pack.packId || 'Approved pack')}</strong>
            <span>${escapeHtml(pack.packId || 'No pack ID')} · ${escapeHtml(pack.subject || 'No subject')} · Grade ${escapeHtml(pack.gradeLevel || 'not set')} · ${escapeHtml(pack.version || 'No version')}</span>
          </div>
          <button type="button" class="teacher-content-switch" disabled aria-label="Pack enable switch placeholder" data-coming-soon="pack-toggle">
            <span></span>
          </button>
        </div>
        <div class="teacher-content-count-strip">
          ${countPill('Vocab', counts.vocabulary)}
          ${countPill('Concepts', counts.concepts)}
          ${countPill('Problems', counts.problemBank)}
          ${countPill('Standards', counts.standardsMap)}
          ${countPill('Smoke Tests', counts.smokeTests)}
          ${countPill('Indexed', Object.values(indexed).reduce((sum, value) => sum + Number(value || 0), 0))}
        </div>
      </section>
    `;
  }

  function cardWithEmptyState(title, message) {
    return `
      <div class="teacher-content-card-head">
        <h4>${escapeHtml(title)}</h4>
        <span class="teacher-content-pill muted">Empty</span>
      </div>
      <p class="profile-empty-state">${escapeHtml(message)}</p>
    `;
  }

  function renderFooter() {
    const index = activeTabIndex();
    const back = byId('teacherContentBack');
    const next = byId('teacherContentNext');
    if (back) back.disabled = index <= 0;
    if (next) next.disabled = index >= TABS.length - 1;
    const label = byId('teacherContentStepLabel');
    if (label) label.textContent = `${index + 1} of ${TABS.length}: ${tabLabel(state.activeTab)}`;
  }

  function renderStatus() {
    if (state.loading) {
      setStatus('Loading teacher content...');
      return;
    }

    if (state.errors.length) {
      setStatus(`${state.errors.length} warning/error item${state.errors.length === 1 ? '' : 's'} found. Draft review actions only.`);
      return;
    }

    const draftCount = state.dashboard?.draftPacks ?? state.drafts.length;
    const approvedCount = state.dashboard?.approvedPacks ?? state.approved.length;
    setStatus(`${formatNumber(draftCount)} draft pack${Number(draftCount) === 1 ? '' : 's'} · ${formatNumber(approvedCount)} approved pack${Number(approvedCount) === 1 ? '' : 's'}.`);
  }

  function setStatus(message) {
    const status = byId('teacherContentLoadStatus');
    if (status) status.textContent = message;
    const entryStatus = byId('teacherContentEntryStatus');
    if (entryStatus && message) entryStatus.textContent = message;
  }

  function setActiveTab(tabId) {
    if (!TABS.some((tab) => tab.id === tabId)) return;
    state.activeTab = tabId;
    render();
  }

  function shiftTab(delta) {
    const nextIndex = Math.max(0, Math.min(TABS.length - 1, activeTabIndex() + delta));
    setActiveTab(TABS[nextIndex].id);
  }

  function activeTabIndex() {
    const index = TABS.findIndex((tab) => tab.id === state.activeTab);
    return index >= 0 ? index : 0;
  }

  function tabLabel(tabId) {
    return TABS.find((tab) => tab.id === tabId)?.label || 'Teacher Content';
  }

  function getSelectedDraftSummary() {
    return state.drafts.find((draft) => draft.packId === state.selectedDraftPackId) || null;
  }

  function openReviewItem(button) {
    const item = findPendingItem(button.dataset.section, Number(button.dataset.index));
    if (!item) {
      state.errors.push('Review item is no longer pending. Refresh the draft report.');
      render();
      return;
    }

    state.selectedReviewItem = item;
    render();
  }

  function closeReviewItem() {
    state.selectedReviewItem = null;
    render();
  }

  async function updateReviewStatusFromButton(button) {
    await patchReviewStatus(button.dataset.section, Number(button.dataset.index), button.dataset.reviewStatus);
  }

  async function patchReviewStatus(section, index, reviewStatus) {
    if (!state.selectedDraftPackId || !section || !Number.isInteger(index)) return;
    await mutateReviewDraft(
      ENDPOINTS.draftItemStatus(state.selectedDraftPackId, section, index),
      { reviewStatus },
      `Marked ${SECTION_LABELS[section] || section} item ${index} ${reviewStatus}.`
    );
  }

  async function saveReviewEdits() {
    const item = state.selectedReviewItem;
    if (!item || !state.selectedDraftPackId) return;

    const fields = Array.from(document.querySelectorAll('[data-review-field]'));
    const allowedFields = EDITABLE_FIELDS[item.section] || [];
    const changed = fields
      .map((field) => ({
        field: field.getAttribute('data-review-field'),
        value: field.value
      }))
      .filter((entry) => allowedFields.includes(entry.field));

    if (!changed.length) {
      state.errors.push('No editable fields were available for this item.');
      render();
      return;
    }

    state.reviewActionLoading = true;
    state.errors = [];
    setStatus('Saving draft item edits...');
    render();

    try {
      let latestReport = null;
      for (const entry of changed) {
        const payload = await fetchJson(ENDPOINTS.draftItem(state.selectedDraftPackId, item.section, item.index), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        });
        const data = unwrap(payload);
        latestReport = data?.report || latestReport;
      }

      if (latestReport) state.report = latestReport;
      await refreshDraftLists();
      reconcileSelectedReviewItem();
      setStatus('Saved draft item edits.');
    } catch (error) {
      state.errors.push(`Draft item save failed: ${error.message || 'Route error'}`);
    } finally {
      state.reviewActionLoading = false;
      render();
    }
  }

  async function mutateReviewDraft(url, body, successMessage) {
    state.reviewActionLoading = true;
    state.errors = [];
    setStatus('Saving draft review action...');
    render();

    try {
      const payload = await fetchJson(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = unwrap(payload);
      if (data?.report) state.report = data.report;
      await refreshDraftLists();
      reconcileSelectedReviewItem();
      setStatus(successMessage);
    } catch (error) {
      state.errors.push(`Draft review action failed: ${error.message || 'Route error'}`);
    } finally {
      state.reviewActionLoading = false;
      render();
    }
  }

  async function refreshDraftLists() {
    const [dashboardResult, draftsResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts)
    ]);
    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
  }

  function reconcileSelectedReviewItem() {
    if (!state.selectedReviewItem) return;
    const next = findPendingItem(state.selectedReviewItem.section, Number(state.selectedReviewItem.index));
    state.selectedReviewItem = next || null;
  }

  function findPendingItem(section, index) {
    const items = state.report?.pendingReview?.items?.[section] || [];
    return items.find((item) => Number(item.index) === Number(index)) || null;
  }

  function metric(label, value) {
    return `
      <div class="teacher-content-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value === undefined || value === null || value === '' ? 'Not available' : value)}</strong>
      </div>
    `;
  }

  function renderCounts(title, counts) {
    const safeCounts = counts && typeof counts === 'object' ? counts : {};
    return `
      <section class="teacher-content-counts">
        <h5>${escapeHtml(title)}</h5>
        <div class="teacher-content-count-strip">
          ${Object.keys(safeCounts).length
            ? Object.entries(safeCounts).map(([label, value]) => countPill(titleCase(label), value)).join('')
            : '<span class="profile-empty-state">No counts available.</span>'}
        </div>
      </section>
    `;
  }

  function renderIssueList(title, items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    return `
      <section class="teacher-content-issues">
        <h5>${escapeHtml(title)}</h5>
        ${list.length
          ? `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : '<p class="profile-empty-state">None.</p>'}
      </section>
    `;
  }

  function renderChipList(title, items) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    return `
      <section class="teacher-content-chip-section">
        <h5>${escapeHtml(title)}</h5>
        ${list.length
          ? `<div class="teacher-content-chip-list">${list.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
          : '<p class="profile-empty-state">None available.</p>'}
      </section>
    `;
  }

  function countPill(label, value) {
    return `
      <span class="teacher-content-count-pill">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(formatNumber(value))}</strong>
      </span>
    `;
  }

  function passFail(value) {
    if (value === true) return 'Passed';
    if (value === false) return 'Failed';
    return 'Not available';
  }

  function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('charlemagne:blade-active', init);

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.teacherContent = {
    endpoints: ENDPOINTS,
    open: openOverlay,
    close: closeOverlay,
    reload: loadTeacherContent,
    state: () => ({ ...state })
  };
})();
