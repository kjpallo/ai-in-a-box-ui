(() => {
  const ENDPOINTS = {
    dashboard: '/api/teacher-content/dashboard',
    uploadExtract: '/api/teacher-content/uploads/extract',
    uploadPrepareReview: (uploadId) => `/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review`,
    drafts: '/api/teacher-content/drafts',
    draftReport: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/report`,
    promoteDraft: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote`,
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
    promotionActionLoading: false,
    promotionMessage: '',
    selectedUploadFile: null,
    uploadExtractionLoading: false,
    uploadExtractionResult: null,
    uploadContentName: '',
    uploadPrepareReviewLoading: false,
    uploadPrepareReviewMessage: '',
    uploadPrepareReviewHandoff: null,
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
        return;
      }

      const promoteButton = event.target.closest('[data-promote-draft]');
      if (promoteButton) {
        event.preventDefault();
        promoteSelectedDraft();
        return;
      }

      const uploadBrowse = event.target.closest('[data-upload-browse]');
      if (uploadBrowse) {
        event.preventDefault();
        byId('teacherContentUploadFile')?.click();
        return;
      }

      const uploadExtract = event.target.closest('[data-upload-extract]');
      if (uploadExtract) {
        event.preventDefault();
        extractSelectedUpload();
        return;
      }

      const prepareReview = event.target.closest('[data-upload-prepare-review]');
      if (prepareReview) {
        event.preventDefault();
        prepareReviewFromUpload();
        return;
      }

      const handoffNav = event.target.closest('[data-handoff-tab]');
      if (handoffNav) {
        event.preventDefault();
        setActiveTab(handoffNav.getAttribute('data-handoff-tab'));
        return;
      }

      const reviewEmptyNav = event.target.closest('[data-review-empty-tab]');
      if (reviewEmptyNav) {
        event.preventDefault();
        setActiveTab(reviewEmptyNav.getAttribute('data-review-empty-tab'));
      }
    });

    byId('teacherContentBack')?.addEventListener('click', () => shiftTab(-1));
    byId('teacherContentNext')?.addEventListener('click', () => shiftTab(1));
    byId('teacherContentDraftSelect')?.addEventListener('change', async (event) => {
      state.selectedDraftPackId = event.target.value || '';
      state.selectedReviewItem = null;
      state.promotionMessage = '';
      await loadSelectedDraftReport();
      render();
    });

    document.addEventListener('change', (event) => {
      if (event.target?.id !== 'teacherContentUploadFile') return;
      state.selectedUploadFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      state.uploadExtractionResult = null;
      state.uploadContentName = state.selectedUploadFile ? makeContentNameFromFileName(state.selectedUploadFile.name) : '';
      state.uploadPrepareReviewMessage = '';
      state.uploadPrepareReviewHandoff = null;
      render();
    });

    document.addEventListener('input', (event) => {
      if (event.target?.id !== 'teacherContentKnowledgeName') return;
      state.uploadContentName = event.target.value || '';
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
    const result = state.uploadExtractionResult || {};
    const extraction = result.extraction || {};
    const selectedName = state.selectedUploadFile?.name || result.originalFileName || 'No file selected';
    const canExtract = Boolean(state.selectedUploadFile) && !state.uploadExtractionLoading;
    const extractionSucceeded = Boolean(result.uploadId && extraction.success !== false && !(result.errors || []).length);
    const canPrepareReview = extractionSucceeded && !state.uploadPrepareReviewLoading;
    const status = state.uploadExtractionLoading
      ? 'Extracting'
      : state.uploadPrepareReviewLoading
        ? 'Preparing'
      : result.uploadId
        ? (extraction.success === false || (result.errors || []).length ? 'Failed' : 'Extracted')
        : 'Ready';
    const contentName = state.uploadContentName || makeContentNameFromFileName(result.originalFileName || selectedName);
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Create New Knowledge</h4>
          <p>Upload a source, extract text, then prepare review cards for teacher approval.</p>
        </div>
        <span class="teacher-content-pill ${status === 'Failed' ? 'blocked' : status === 'Extracted' ? 'ready' : 'muted'}">${escapeHtml(status)}</span>
      </div>
      <div class="teacher-content-upload-row">
        <input
          id="teacherContentUploadFile"
          class="sr-only"
          type="file"
          accept=".txt,.csv,.json,.docx,.xlsx,.pdf"
          data-upload-file-input
        >
        <button type="button" class="small-button" data-upload-browse>Browse</button>
        <div class="teacher-content-file-placeholder" data-selected-file>
          ${escapeHtml(selectedName)}
        </div>
        <button
          type="button"
          class="small-button secondary-small"
          data-upload-extract
          ${canExtract ? '' : 'disabled'}
        >${state.uploadExtractionLoading ? 'Extracting...' : 'Extract Text'}</button>
      </div>
      <p class="teacher-content-upload-note">Supported file types: .txt, .csv, .json, .docx, .xlsx, .pdf. Draft items stay pending until teacher review.</p>
      <div class="teacher-content-upload-row">
        <label class="teacher-content-name-field" for="teacherContentKnowledgeName">
          <span>Knowledge Name</span>
          <input
            id="teacherContentKnowledgeName"
            type="text"
            value="${escapeAttr(contentName)}"
            placeholder="Name this knowledge content"
            data-upload-content-name
            ${extractionSucceeded ? '' : 'disabled'}
          >
        </label>
        <button
          type="button"
          class="small-button"
          data-upload-prepare-review
          ${canPrepareReview ? '' : 'disabled'}
        >${state.uploadPrepareReviewLoading ? 'Preparing your review draft...' : 'Prepare Review'}</button>
      </div>
      <p class="teacher-content-upload-note" data-upload-prepare-review-status>
        ${escapeHtml(state.uploadPrepareReviewLoading
          ? 'Charlemagne is preparing your review draft...'
          : state.uploadPrepareReviewMessage || 'Prepare Review becomes available after text extraction succeeds.')}
      </p>
      ${renderPrepareReviewHandoff()}
      <div class="teacher-content-metric-grid">
        ${metric('Original File', result.originalFileName || state.selectedUploadFile?.name || 'Not selected')}
        ${metric('File Type', result.fileType || extraction.detectedType || 'Not selected')}
        ${metric('Extraction Status', state.uploadExtractionLoading ? 'In progress' : passFail(extraction.success))}
        ${metric('Character Count', formatNumber(result.characterCount ?? extraction.characterCount))}
        ${metric('Sections Found', formatNumber(result.sectionsCount ?? extraction.sectionsCount))}
        ${metric('Tables Found', formatNumber(result.tablesCount ?? extraction.tablesCount))}
      </div>
      ${renderIssueList('Warnings', result.warnings || extraction.warnings)}
      ${renderIssueList('Errors', result.errors || extraction.errors)}
    `;
  }

  function renderStandardsCard() {
    const summary = state.report?.standardsSummary || null;
    const standardIds = Array.isArray(summary?.standardIds) ? summary.standardIds : [];
    const standards = Array.isArray(summary?.standards) ? summary.standards : standardIds.map((standardId) => ({ standardId }));
    const unknown = Array.isArray(summary?.unknown) ? summary.unknown : [];
    const missing = Array.isArray(summary?.missing) ? summary.missing : [];
    if (!state.selectedDraftPackId) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Standards</h4>
            <p>Connect this knowledge pack to the standards students are expected to learn.</p>
          </div>
          <span class="teacher-content-pill muted">Coming Soon</span>
        </div>
        <p class="profile-empty-state">No draft selected. Prepare Review from an upload or choose a draft pack to see its standards alignment.</p>
        ${renderStandardsPlaceholders()}
      `;
    }

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Standards</h4>
          <p>Connect this knowledge pack to the standards students are expected to learn.</p>
        </div>
        <span class="teacher-content-pill muted">Read Only</span>
      </div>
      ${renderStandardsPlaceholders()}
      ${summary?.standardsBankLoaded === false ? '<p class="profile-empty-state" data-standards-bank-empty>Standards bank not loaded. Existing draft IDs are shown without bank details.</p>' : ''}
      <div class="teacher-content-metric-grid">
        ${metric('Standards Map Count', formatNumber(summary?.standardsMapCount), 'data-standards-map-count')}
        ${metric('Standard IDs Used', formatNumber(standardIds.length), 'data-standards-id-count')}
        ${metric('Unknown Standards', formatNumber(unknown.length), 'data-standards-unknown-count')}
        ${metric('Missing Standards', formatNumber(missing.length), 'data-standards-missing-count')}
      </div>
      ${standardIds.length ? renderChipList('Standard IDs', standardIds, 'data-standard-id-list') : '<p class="profile-empty-state" data-standards-empty>No standardsMap entries or standard IDs were found for this draft.</p>'}
      ${unknown.length ? renderChipList('Unknown standards found', unknown, 'data-standards-unknown-list') : ''}
      ${missing.length ? renderChipList('Standards used without standardsMap entries', missing, 'data-standards-missing-list') : ''}
      ${standards.length ? `<div class="teacher-content-standards-list">${standards.map(renderStandardCard).join('')}</div>` : ''}
    `;
  }

  function renderStandardsPlaceholders() {
    return `
      <section class="teacher-content-standards-tools" data-standards-placeholder-controls>
        <label class="teacher-content-standards-select">
          <span>Select existing standards</span>
          <select disabled data-coming-soon="standards-select" aria-label="Select existing standards placeholder">
            <option>Select existing standards - coming soon</option>
          </select>
        </label>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-upload">Upload standards file</button>
        <label class="teacher-content-standards-select">
          <span>Replace standard</span>
          <select disabled data-coming-soon="standards-replace" aria-label="Replace standard placeholder">
            <option>Replace standard - coming soon</option>
          </select>
        </label>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-edit">Edit standard</button>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-vocab">Vocab</button>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-content-concept">Content/Concept</button>
        <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-source">Source</button>
      </section>
    `;
  }

  function renderStandardCard(standard) {
    const vocabulary = Array.isArray(standard.relatedVocabulary) ? standard.relatedVocabulary : [];
    const concepts = Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
    const confidence = standard.confidence ? formatConfidence(standard.confidence) : null;
    return `
      <section class="teacher-content-standard-card" data-standard-card>
        <div class="teacher-content-standard-head">
          <div>
            <strong data-standard-id>${escapeHtml(standard.standardId || 'Standard ID not set')}</strong>
            ${standard.title ? `<span data-standard-title>${escapeHtml(standard.title)}</span>` : '<span data-standard-title>No title loaded for this standard.</span>'}
          </div>
          ${confidence ? `<span class="teacher-content-confidence ${escapeAttr(confidence.className)}" data-standard-confidence>${escapeHtml(confidence.label)}</span>` : ''}
        </div>
        ${standard.description ? `<p data-standard-description>${escapeHtml(standard.description)}</p>` : '<p data-standard-description>Only the standard ID is available for this draft.</p>'}
        <div class="teacher-content-standard-meta">
          <span data-standard-review-status>Review status: ${escapeHtml(standard.reviewStatus || 'Not set')}</span>
          <span data-standard-source>Source: ${escapeHtml([standard.sourceFile, standard.sourceLocation].filter(Boolean).join(' · ') || 'Not loaded')}</span>
        </div>
        ${renderInlineChipList('Related vocabulary', vocabulary, 'data-standard-vocabulary')}
        ${renderInlineChipList('Related concepts', concepts, 'data-standard-concepts')}
      </section>
    `;
  }

  function renderDraftPackCard() {
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    if (!draft || !state.selectedDraftPackId) {
      return cardWithEmptyState('Draft Pack', 'No draft pack is selected yet. Prepare Review from an upload or choose a draft pack to see its review summary.');
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
      ${renderSelectedDraftSummary(draft)}
      ${state.uploadPrepareReviewHandoff?.packId === state.selectedDraftPackId ? renderPrepareReviewHandoff() : ''}
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
      return cardWithEmptyState('Review', 'No draft pack is selected yet. Choose a draft pack before reviewing pending items.');
    }

    if (state.reviewActionLoading) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Review Draft Items</h4>
            <p>Saving draft-only review change...</p>
          </div>
          <span class="teacher-content-pill review">Saving</span>
        </div>
        <p class="profile-empty-state">Refreshing the selected draft report.</p>
      `;
    }

    if (!pending || pending.totalPending === 0) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Review Draft Items</h4>
            <p>Check each pending item before this knowledge can go live.</p>
          </div>
          <span class="teacher-content-pill ready">Review complete</span>
        </div>
        ${renderReviewProgressSummary(getReviewProgressSummary(state.report?.draftPack || getSelectedDraftSummary()))}
        <section class="teacher-content-review-empty" data-review-empty-state>
          <h5>No pending review items.</h5>
          <p>Check the Import Report to see if this draft is ready to promote.</p>
          <button type="button" class="small-button secondary-small" data-review-empty-tab="importReport">View Import Report</button>
        </section>
        ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
      `;
    }

    const groups = pending.items || {};
    const summary = getReviewProgressSummary(state.report?.draftPack || getSelectedDraftSummary());
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Review Draft Items</h4>
          <p>Check each pending item before this knowledge can go live.</p>
        </div>
        <span class="teacher-content-pill review">Draft Only</span>
      </div>
      ${renderReviewProgressSummary(summary)}
      ${state.errors.length ? renderIssueList('Review Messages', state.errors) : ''}
      <div class="teacher-content-review-groups">
        ${Object.keys(SECTION_LABELS).map((sectionName) => renderReviewGroup(sectionName, groups[sectionName] || [])).join('')}
      </div>
      ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
    `;
  }

  function renderReviewGroup(sectionName, items) {
    return `
      <section class="teacher-content-review-group" data-review-section="${escapeAttr(sectionName)}">
        <div class="teacher-content-review-group-head">
          <h5>${escapeHtml(SECTION_LABELS[sectionName])}</h5>
          <span data-review-section-pending="${escapeAttr(sectionName)}">${formatNumber(items.length)} pending</span>
        </div>
        ${items.length ? items.map(renderPendingItem).join('') : '<p class="profile-empty-state">No pending items in this section.</p>'}
      </section>
    `;
  }

  function renderPendingItem(item) {
    const confidence = formatConfidence(item.confidence);
    return `
      <div class="teacher-content-review-item" data-review-item-card>
        <div class="teacher-content-review-item-main">
          <strong data-review-item-label>${escapeHtml(item.label || 'Pending item')}</strong>
          <span data-review-item-section>Section: ${escapeHtml(SECTION_LABELS[item.section] || item.section || 'Not set')}</span>
          <span data-review-item-status>Status: ${escapeHtml(item.reviewStatus || 'pending')}</span>
          <span data-review-item-source>Source: ${escapeHtml(item.sourceFile || 'No source file')} · ${escapeHtml(item.sourceLocation || 'No source location')}</span>
        </div>
        <div class="teacher-content-review-item-evidence">
          <span class="teacher-content-confidence ${escapeAttr(confidence.className)}" data-review-item-confidence>${escapeHtml(confidence.label)}</span>
          <p data-review-item-snippet>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        </div>
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
          <h5>Source evidence</h5>
          <p>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        </section>
        <section class="teacher-content-edit-section">
          <h5>Editable fields</h5>
          <p>Only teacher-review fields for this section can be changed here.</p>
        <div class="teacher-content-edit-fields">
          ${editableFields.map((fieldName) => renderEditableField(fieldName, item.editableFields?.[fieldName])).join('')}
        </div>
        </section>
        <div class="teacher-content-review-detail-actions">
          <button type="button" class="small-button" data-review-save>Save changes</button>
          <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Approve item</button>
          <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Reject item</button>
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
      return cardWithEmptyState('Import Report', 'No draft report selected. Prepare Review from an upload or choose a draft pack to see whether it is ready to promote.');
    }

    if (!state.report) {
      return cardWithEmptyState('Import Report', 'Report failed to load or is still unavailable. Refresh the selected draft before promoting.');
    }

    const extraction = state.report?.sourceExtraction || {};
    const draft = state.report?.draftPack || {};
    const readiness = state.report?.promotionReadiness || {};
    const promoted = state.promotionMessage === 'Promoted successfully';
    const status = promoted ? 'Promoted successfully' : readiness.ready ? 'Ready to promote' : readiness.blockedReasons?.length ? 'Blocked' : 'Needs teacher review';
    const statusClass = promoted || readiness.ready ? 'ready' : status === 'Blocked' ? 'blocked' : 'review';
    const reviewSummary = getReviewProgressSummary(draft);
    const blockedReasons = readiness.blockedReasons || [];
    const disabledReason = readiness.ready
      ? ''
      : (blockedReasons.length ? blockedReasons.join('; ') : 'Draft not ready. Finish teacher review before promoting.');
    const promoteDisabled = !readiness.ready || state.promotionActionLoading;
    const promoteLabel = state.promotionActionLoading ? 'Promoting...' : 'Promote';

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Import Report</h4>
          <p>This report checks whether the reviewed draft is ready to become an approved knowledge pack.</p>
        </div>
        <span class="teacher-content-pill ${statusClass}" data-import-report-readiness-status>${escapeHtml(status)}</span>
      </div>
      <section class="teacher-content-readiness-card ${statusClass}" data-import-report-readiness-card>
        <span>Readiness Status</span>
        <strong>${escapeHtml(status)}</strong>
        <p>${escapeHtml(getReadinessCopy(status, disabledReason))}</p>
      </section>
      <section class="teacher-content-counts" data-import-report-review-summary>
        <h5>Review count summary</h5>
        <div class="teacher-content-count-strip">
          ${countPill('Pending', reviewSummary.pending, 'data-import-report-pending')}
          ${countPill('Approved', reviewSummary.approved, 'data-import-report-approved')}
          ${countPill('Rejected', reviewSummary.rejected, 'data-import-report-rejected')}
          ${countPill('Total reviewable', reviewSummary.total, 'data-import-report-total-reviewable')}
        </div>
      </section>
      <section class="teacher-content-counts" data-import-report-validation-summary>
        <h5>Validation and extraction summary</h5>
        <div class="teacher-content-count-strip">
          ${countPill('Extraction', passFailUnknown(extraction.success), 'data-import-report-extraction')}
          ${countPill('Draft validation', passFailUnknown(draft.validationPassed), 'data-import-report-validation')}
          ${countPill('Warnings', countItems(state.report?.warnings), 'data-import-report-warnings')}
          ${countPill('Errors', countItems(state.report?.errors), 'data-import-report-errors')}
        </div>
      </section>
      ${renderBlockedReasons(blockedReasons)}
      <section class="teacher-content-promotion-panel">
        <div>
          <strong>${escapeHtml(state.promotionMessage || status)}</strong>
          <span>Promotion copies reviewed draft content into approved knowledge packs.</span>
          <span>It will not change student answering yet.</span>
          <small>${escapeHtml(readiness.ready ? 'Existing safety checks will run again before anything is copied.' : disabledReason)}</small>
        </div>
        <button
          type="button"
          class="small-button"
          data-promote-draft
          ${promoteDisabled ? 'disabled' : ''}
          title="${escapeAttr(promoteDisabled ? disabledReason : 'Promote reviewed draft content')}"
        >${escapeHtml(promoteLabel)}</button>
      </section>
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

  async function promoteSelectedDraft() {
    if (!state.selectedDraftPackId || !state.report?.promotionReadiness?.ready || state.promotionActionLoading) return;

    const confirmed = window.confirm(
      'This will copy reviewed draft content into approved knowledge packs. It will not change student answering yet.'
    );
    if (!confirmed) return;

    state.promotionActionLoading = true;
    state.promotionMessage = '';
    state.errors = [];
    setStatus('Promoting draft knowledge pack...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.promoteDraft(state.selectedDraftPackId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: false })
      });
      const data = unwrap(payload);
      state.promotionMessage = 'Promoted successfully';
      if (data?.dashboard) state.dashboard = data.dashboard;
      if (data?.report) state.report = data.report;
      if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
      await refreshTeacherContentSummaries();
      setStatus('Promoted successfully');
    } catch (error) {
      state.errors.push(`Draft promotion failed: ${error.message || 'Route error'}`);
      state.promotionMessage = 'Blocked';
      await loadSelectedDraftReport();
    } finally {
      state.promotionActionLoading = false;
      render();
    }
  }

  async function extractSelectedUpload() {
    if (!state.selectedUploadFile || state.uploadExtractionLoading) return;

    state.uploadExtractionLoading = true;
    state.uploadExtractionResult = null;
    state.errors = [];
    setStatus('Uploading and extracting teacher source file...');
    render();

    try {
      const formData = new FormData();
      formData.append('sourceFile', state.selectedUploadFile);
      const payload = await fetchJson(ENDPOINTS.uploadExtract, {
        method: 'POST',
        body: formData
      });
      const data = unwrap(payload);
      state.uploadExtractionResult = data || null;
      state.uploadContentName = state.uploadContentName || makeContentNameFromFileName(data?.originalFileName || state.selectedUploadFile?.name || '');
      state.uploadPrepareReviewMessage = data?.uploadId ? 'Prepare Review is ready.' : '';
      setStatus('Text extraction finished. Prepare Review is ready.');
    } catch (error) {
      state.uploadExtractionResult = {
        originalFileName: state.selectedUploadFile?.name || '',
        errors: [error.message || 'Upload extraction failed.'],
        warnings: [],
        extraction: {
          success: false,
          errors: [error.message || 'Upload extraction failed.'],
          warnings: []
        }
      };
      setStatus('Upload extraction failed.');
    } finally {
      state.uploadExtractionLoading = false;
      render();
    }
  }

  async function prepareReviewFromUpload() {
    const uploadId = state.uploadExtractionResult?.uploadId;
    if (!uploadId || state.uploadPrepareReviewLoading) return;

    state.uploadPrepareReviewLoading = true;
    state.uploadPrepareReviewMessage = 'Charlemagne is preparing your review draft...';
    state.errors = [];
    setStatus('Preparing your review draft...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.uploadPrepareReview(uploadId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packName: state.uploadContentName || makeContentNameFromFileName(state.uploadExtractionResult?.originalFileName || ''),
          retryInvalidJson: true
        })
      });
      const data = unwrap(payload);
      state.uploadPrepareReviewMessage = data?.message || 'Review draft prepared.';
      state.uploadPrepareReviewHandoff = {
        packId: data?.packId || '',
        reportRefreshFailed: false
      };
      if (data?.dashboard) state.dashboard = data.dashboard;
      if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
      if (data?.packId) state.selectedDraftPackId = data.packId;
      if (data?.draftReport) state.report = data.draftReport;
      state.selectedReviewItem = null;
      const refreshErrorsBefore = state.errors.length;
      await refreshDraftLists();
      if (state.selectedDraftPackId) await loadSelectedDraftReport();
      if (state.errors.length > refreshErrorsBefore) {
        state.uploadPrepareReviewMessage = 'Review draft prepared, but the latest report could not be refreshed.';
        state.uploadPrepareReviewHandoff.reportRefreshFailed = true;
      }
      state.activeTab = 'draftPack';
      setStatus('Review draft prepared.');
    } catch (error) {
      state.uploadPrepareReviewMessage = 'Prepare Review failed.';
      state.uploadPrepareReviewHandoff = null;
      state.errors.push(`Prepare Review failed: ${error.message || 'Route error'}`);
      setStatus('Prepare Review failed.');
    } finally {
      state.uploadPrepareReviewLoading = false;
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

  async function refreshTeacherContentSummaries() {
    const [dashboardResult, draftsResult, approvedResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.approved)
    ]);
    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(approvedResult, 'approved');
    await loadSelectedDraftReport();
  }

  function applyApprovedSummary(data) {
    state.approved = Array.isArray(data?.approvedPacks) ? data.approvedPacks : [];
    state.approvedIndexedCounts = data?.indexedCounts || null;
    state.approvedSearchableCounts = data?.searchableCounts || null;
    collectApiIssues(data);
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

  function metric(label, value, dataSelector) {
    const dataAttr = dataSelector ? ` ${escapeAttr(dataSelector)}` : '';
    return `
      <div class="teacher-content-metric"${dataAttr}>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value === undefined || value === null || value === '' ? 'Not available' : value)}</strong>
      </div>
    `;
  }

  function renderPrepareReviewHandoff() {
    if (!state.uploadPrepareReviewHandoff?.packId) return '';
    const draft = state.report?.draftPack || getSelectedDraftSummary() || {};
    const summary = getReviewProgressSummary(draft);
    const refreshCopy = state.uploadPrepareReviewHandoff.reportRefreshFailed
      ? 'Review draft prepared, but the latest report could not be refreshed. Open Import Report after refresh is available.'
      : 'Draft packs are not live until approved and promoted.';

    return `
      <section class="teacher-content-handoff" data-prepare-review-handoff>
        <div class="teacher-content-handoff-copy">
          <span class="teacher-content-pill ready">Review draft prepared.</span>
          <strong>Next step: review pending items before this knowledge can go live.</strong>
          <p>${escapeHtml(refreshCopy)}</p>
        </div>
        ${renderReviewProgressSummary(summary)}
        <div class="teacher-content-handoff-actions">
          <button type="button" class="small-button" data-handoff-tab="review">Go to Review</button>
          <button type="button" class="small-button secondary-small" data-handoff-tab="importReport">View Import Report</button>
        </div>
      </section>
    `;
  }

  function renderSelectedDraftSummary(draft) {
    const summary = getReviewProgressSummary(draft);
    return `
      <section class="teacher-content-selected-draft" data-selected-draft-summary>
        <div>
          <span>Selected draft pack</span>
          <strong data-selected-draft-title>${escapeHtml(draft.title || 'Untitled draft pack')}</strong>
          <small data-selected-draft-pack-id>${escapeHtml(draft.packId || state.selectedDraftPackId || 'No pack ID')}</small>
        </div>
        <div class="teacher-content-selected-draft-meta">
          <span data-selected-draft-pending>Pending review: ${formatNumber(summary.pending)}</span>
          <span data-selected-draft-validation>Validation: ${escapeHtml(passFail(draft.validationPassed))}</span>
        </div>
      </section>
      ${renderReviewProgressSummary(summary)}
    `;
  }

  function renderReviewProgressSummary(summary) {
    const reviewed = summary.approved + summary.rejected;
    const percent = summary.total > 0 ? Math.round((reviewed / summary.total) * 100) : 0;
    return `
      <section class="teacher-content-review-progress" data-review-progress-summary>
        <div class="teacher-content-progress-head">
          <strong>Review progress</strong>
          <span data-review-progress-percent>${formatNumber(percent)}% reviewed</span>
        </div>
        <div class="teacher-content-progress-bar" aria-label="Review progress">
          <span style="width: ${Math.max(0, Math.min(100, percent))}%"></span>
        </div>
        <div class="teacher-content-count-strip">
          ${countPill('Pending Items', summary.pending, 'data-review-progress-pending')}
          ${countPill('Approved Items', summary.approved, 'data-review-progress-approved')}
          ${countPill('Rejected Items', summary.rejected, 'data-review-progress-rejected')}
          ${countPill('Total Reviewable Items', summary.total, 'data-review-progress-total')}
        </div>
      </section>
    `;
  }

  function getReviewProgressSummary(draft) {
    const counts = draft?.reviewCounts || {};
    const pending = Number(counts.pending || state.report?.pendingReview?.totalPending || 0);
    const approved = Number(counts.approved || 0);
    const rejected = Number(counts.rejected || 0);
    const total = Number(counts.total || pending + approved + rejected);
    return { pending, approved, rejected, total };
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

  function renderBlockedReasons(blockedReasons) {
    const reasons = Array.isArray(blockedReasons) ? blockedReasons.filter(Boolean) : [];
    return `
      <section class="teacher-content-blocked-reasons" data-import-report-blocked-reasons>
        <h5>Blocked reasons</h5>
        ${reasons.length
          ? reasons.map((reason) => `<p data-import-report-blocked-reason>${escapeHtml(reason)}</p>`).join('')
          : '<p class="profile-empty-state">No blocked reasons reported.</p>'}
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

  function getReadinessCopy(status, disabledReason) {
    if (status === 'Promoted successfully') return 'This draft was copied into approved knowledge packs.';
    if (status === 'Ready to promote') return 'Teacher review and validation checks are complete.';
    if (status === 'Blocked') return disabledReason || 'One or more required checks need attention.';
    return 'Pending review items still need teacher approval or rejection.';
  }

  function passFailUnknown(value) {
    if (value === true) return 'Passed';
    if (value === false) return 'Failed';
    return 'Unknown';
  }

  function countItems(value) {
    return Array.isArray(value) ? value.length : 0;
  }

  function renderChipList(title, items, dataSelector) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    const dataAttr = dataSelector ? ` ${escapeAttr(dataSelector)}` : '';
    return `
      <section class="teacher-content-chip-section"${dataAttr}>
        <h5>${escapeHtml(title)}</h5>
        ${list.length
          ? `<div class="teacher-content-chip-list">${list.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>`
          : '<p class="profile-empty-state">None available.</p>'}
      </section>
    `;
  }

  function renderInlineChipList(title, items, dataSelector) {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    const dataAttr = dataSelector ? ` ${escapeAttr(dataSelector)}` : '';
    return `
      <div class="teacher-content-standard-chips"${dataAttr}>
        <span>${escapeHtml(title)}:</span>
        ${list.length
          ? list.map((item) => `<strong>${escapeHtml(item)}</strong>`).join('')
          : '<em>None loaded</em>'}
      </div>
    `;
  }

  function countPill(label, value, dataSelector) {
    const dataAttr = dataSelector ? ` ${escapeAttr(dataSelector)}` : '';
    return `
      <span class="teacher-content-count-pill"${dataAttr}>
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(formatNumber(value))}</strong>
      </span>
    `;
  }

  function formatConfidence(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'high' || normalized === 'high confidence') {
      return { label: 'High confidence', className: 'high' };
    }
    if (normalized === 'low' || normalized === 'low confidence') {
      return { label: 'Low confidence', className: 'low' };
    }
    if (normalized === 'medium' || normalized === 'medium confidence') {
      return { label: 'Medium confidence', className: 'medium' };
    }
    return { label: 'Medium confidence', className: 'medium' };
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

  function makeContentNameFromFileName(fileName) {
    const baseName = String(fileName || '')
      .replace(/^.*[\\/]/, '')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return baseName ? titleCase(baseName) : '';
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
