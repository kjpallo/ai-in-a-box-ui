(() => {
  const ENDPOINTS = {
    dashboard: '/api/teacher-content/dashboard',
    uploadExtract: '/api/teacher-content/uploads/extract',
    uploadAndPrepare: '/api/teacher-content/uploads/upload-and-prepare',
    uploadPrepareReview: (uploadId) => `/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review`,
    drafts: '/api/teacher-content/drafts',
    draftReport: (packId, standardsBankId = '') => {
      const query = standardsBankId ? `?standardsBankId=${encodeURIComponent(standardsBankId)}` : '';
      return `/api/teacher-content/drafts/${encodeURIComponent(packId)}/report${query}`;
    },
    standardsBanks: '/api/teacher-content/standards-banks',
    standardsBank: (standardsBankId) => `/api/teacher-content/standards-banks/${encodeURIComponent(standardsBankId)}`,
    promoteDraft: (packId) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/promote`,
    draftItem: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}`,
    draftItemStatus: (packId, section, index) => `/api/teacher-content/drafts/${encodeURIComponent(packId)}/items/${encodeURIComponent(section)}/${encodeURIComponent(index)}/status`,
    approved: '/api/teacher-content/approved',
    approvedActivation: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}/activation`
  };

  const TABS = [
    { id: 'upload', label: 'Upload Source', shortLabel: 'Upload Source' },
    { id: 'previewImport', label: 'Preview Import', shortLabel: 'Preview Import' },
    { id: 'reviewPreview', label: 'Review Preview', shortLabel: 'Review Preview' },
    { id: 'fullImport', label: 'Full Import', shortLabel: 'Full Import' },
    { id: 'review', label: 'Review Content', shortLabel: 'Review Content' },
    { id: 'approvedPacks', label: 'Approved Packs', shortLabel: 'Approved Packs' }
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

  const IMPORT_ACTIVITY_MESSAGES = {
    uploadReceived: 'Upload received',
    extractingText: 'Extracting text',
    wrapper: 'Building draft packet wrapper',
    gemmaDraft: 'Creating review draft with Gemma',
    validation: 'Running validation',
    draftReady: 'Draft ready for review'
  };

  const state = {
    initialized: false,
    loadedOnce: false,
    loading: false,
    activeTab: 'upload',
    selectedDraftPackId: '',
    dashboard: null,
    drafts: [],
    standardsBanks: [],
    selectedStandardsBankId: '',
    selectedStandardsBank: null,
    standardsSearch: '',
    standardsStrandFilter: '',
    standardsTopicFilter: '',
    standardsMatchFilter: 'used',
    selectedStandardId: '',
    standardsBankLoading: false,
    standardsBankError: '',
    approved: [],
    approvedIndexedCounts: null,
    approvedSearchableCounts: null,
    approvedActivationSaving: {},
    approvedActivationMessages: {},
    report: null,
    selectedReviewItem: null,
    selectedReviewEvidenceItem: null,
    reviewActionLoading: false,
    promotionActionLoading: false,
    promotionMessage: '',
    selectedUploadFile: null,
    uploadExtractionLoading: false,
    uploadCreateReviewLoading: false,
    uploadCreateReviewStage: '',
    uploadCreateReviewError: '',
    uploadCreateReviewTimeline: [],
    uploadExtractionResult: null,
    uploadContentName: '',
    uploadPrepareReviewLoading: false,
    uploadPrepareReviewMessage: '',
    uploadPrepareReviewHandoff: null,
    uploadImportEstimate: null,
    uploadPreviewReport: null,
    uploadPreviewComplete: false,
    uploadPrepareReviewFailedMode: '',
    uploadPrepareReviewLastFailure: null,
    uploadSelectedRangeStart: '1',
    uploadSelectedRangeEnd: '3',
    fullImportConfirmText: '',
    latestPrepareReviewSourceMatch: null,
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

      const reviewEvidence = event.target.closest('[data-review-evidence]');
      if (reviewEvidence) {
        event.preventDefault();
        openReviewEvidence(reviewEvidence);
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

      const reviewEvidenceClose = event.target.closest('[data-review-evidence-close]');
      if (reviewEvidenceClose) {
        event.preventDefault();
        closeReviewEvidence();
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

      const createReviewDraft = event.target.closest('[data-upload-create-review]');
      if (createReviewDraft) {
        event.preventDefault();
        createReviewDraftFromUpload();
        return;
      }

      const previewImport = event.target.closest('[data-upload-run-preview]');
      if (previewImport) {
        event.preventDefault();
        runPreviewImport();
        return;
      }

      const fullImport = event.target.closest('[data-upload-run-full-import]');
      if (fullImport) {
        event.preventDefault();
        runFullImport();
        return;
      }

      const selectedImport = event.target.closest('[data-upload-run-selected-import]');
      if (selectedImport) {
        event.preventDefault();
        runSelectedImport(selectedImport.getAttribute('data-selected-import-preset') || 'range');
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
        return;
      }

      const approvedEmptyNav = event.target.closest('[data-approved-empty-tab]');
      if (approvedEmptyNav) {
        event.preventDefault();
        setActiveTab(approvedEmptyNav.getAttribute('data-approved-empty-tab'));
        return;
      }

      const approvedActivationToggle = event.target.closest('[data-approved-pack-toggle-action]');
      if (approvedActivationToggle) {
        event.preventDefault();
        toggleApprovedPackActivation(approvedActivationToggle);
      }
    });

    byId('teacherContentBack')?.addEventListener('click', () => shiftTab(-1));
    byId('teacherContentNext')?.addEventListener('click', () => shiftTab(1));
    byId('teacherContentDraftSelect')?.addEventListener('change', async (event) => {
      state.selectedDraftPackId = event.target.value || '';
      state.selectedReviewItem = null;
      state.selectedReviewEvidenceItem = null;
      state.promotionMessage = '';
      await loadSelectedDraftReport();
      render();
    });

    document.addEventListener('change', (event) => {
      if (event.target?.id === 'teacherContentStandardsBankSelect') {
        selectStandardsBank(event.target.value || '');
        return;
      }

      if (event.target?.id === 'teacherContentStandardsStrandFilter') {
        state.standardsStrandFilter = event.target.value || '';
        state.selectedStandardId = '';
        render();
        return;
      }

      if (event.target?.id === 'teacherContentStandardsTopicFilter') {
        state.standardsTopicFilter = event.target.value || '';
        state.selectedStandardId = '';
        render();
        return;
      }

      if (event.target?.id === 'teacherContentStandardsMatchFilter') {
        state.standardsMatchFilter = event.target.value || 'all';
        state.selectedStandardId = '';
        render();
        return;
      }

      if (event.target?.id !== 'teacherContentUploadFile') return;
      state.selectedUploadFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      state.uploadExtractionResult = null;
      state.uploadContentName = state.selectedUploadFile ? makeContentNameFromFileName(state.selectedUploadFile.name) : '';
      state.uploadPrepareReviewMessage = '';
      state.uploadCreateReviewStage = '';
      state.uploadCreateReviewError = '';
      state.uploadCreateReviewTimeline = [];
      state.uploadPrepareReviewHandoff = null;
      state.uploadImportEstimate = null;
      state.uploadPreviewReport = null;
      state.uploadPreviewComplete = false;
      state.uploadPrepareReviewFailedMode = '';
      state.uploadPrepareReviewLastFailure = null;
      state.uploadSelectedRangeStart = '1';
      state.uploadSelectedRangeEnd = '3';
      state.fullImportConfirmText = '';
      state.latestPrepareReviewSourceMatch = null;
      render();
    });

    document.addEventListener('input', (event) => {
      if (event.target?.id === 'teacherContentKnowledgeName') {
        state.uploadContentName = event.target.value || '';
        return;
      }

      if (event.target?.id === 'teacherContentStandardsSearch') {
        state.standardsSearch = event.target.value || '';
        state.selectedStandardId = '';
        render();
        return;
      }

      if (event.target?.id === 'teacherContentSelectedPageStart') {
        state.uploadSelectedRangeStart = event.target.value || '';
        return;
      }

      if (event.target?.id === 'teacherContentSelectedPageEnd') {
        state.uploadSelectedRangeEnd = event.target.value || '';
        return;
      }

      if (event.target?.id === 'teacherContentFullImportConfirm') {
        state.fullImportConfirmText = event.target.value || '';
        render();
      }
    });

    document.addEventListener('click', (event) => {
      const standardCard = event.target.closest('[data-standard-card]');
      if (!standardCard) return;
      state.selectedStandardId = standardCard.getAttribute('data-standard-card-id') || '';
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

    const [dashboardResult, draftsResult, standardsBanksResult, approvedResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.standardsBanks),
      fetchJson(ENDPOINTS.approved)
    ]);

    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(standardsBanksResult, 'standardsBanks');
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

    if (kind === 'standardsBanks') {
      state.standardsBanks = Array.isArray(data?.standardsBanks) ? data.standardsBanks : [];
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
      const data = unwrap(await fetchJson(ENDPOINTS.draftReport(state.selectedDraftPackId, state.selectedStandardsBankId)));
      state.report = data || null;
      reconcileSelectedReviewItem();
      collectApiIssues(data);
    } catch (error) {
      state.errors.push(`Draft report failed to load: ${error.message || 'Route error'}`);
    }
  }

  async function selectStandardsBank(standardsBankId) {
    state.selectedStandardsBankId = standardsBankId;
    state.selectedStandardsBank = null;
    state.standardsSearch = '';
    state.standardsStrandFilter = '';
    state.standardsTopicFilter = '';
    state.standardsMatchFilter = 'used';
    state.selectedStandardId = '';
    state.standardsBankError = '';
    state.standardsBankLoading = Boolean(standardsBankId);
    render();

    if (standardsBankId) {
      try {
        state.selectedStandardsBank = unwrap(await fetchJson(ENDPOINTS.standardsBank(standardsBankId)));
      } catch (error) {
        state.standardsBankError = `Selected standards set failed to load: ${error.message || 'Route error'}`;
      }
    }

    state.standardsBankLoading = false;
    await loadSelectedDraftReport();
    render();
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
        <span class="teacher-content-tab-index">${index + 1}</span>
        <span class="teacher-content-tab-copy">
          <strong>${escapeHtml(tab.label)}</strong>
          <small>${escapeHtml(stepStatus(tab.id))}</small>
        </span>
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

    const activeIndex = activeTabIndex();
    deck.innerHTML = TABS.map((tab, index) => {
      const isActive = tab.id === state.activeTab;
      const offset = index - activeIndex;
      return `
      <article
        class="teacher-content-card ${isActive ? 'active' : 'preview'}"
        data-teacher-content-card="${escapeAttr(tab.id)}"
        aria-hidden="${isActive ? 'false' : 'true'}"
        style="--card-depth: ${index}; --deck-offset: ${offset}; --deck-distance: ${Math.abs(offset)}"
      >
        ${isActive ? renderCard(tab.id) : renderDeckPreviewCard(tab, index)}
      </article>
    `;
    }).join('');
  }

  function renderDeckPreviewCard(tab, index) {
    return `
      <div class="teacher-content-preview-card">
        <span class="teacher-content-tab-index">${index + 1}</span>
        <div>
          <strong>${escapeHtml(tab.label)}</strong>
          <small>${escapeHtml(stepStatus(tab.id))}</small>
        </div>
      </div>
    `;
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

    if (tabId === 'upload') return renderUploadSourceCard();
    if (tabId === 'previewImport') return renderPreviewImportCard();
    if (tabId === 'reviewPreview') return renderReviewPreviewCard();
    if (tabId === 'fullImport') return renderFullImportCard();
    if (tabId === 'review') return renderReviewCard();
    return renderApprovedPacksCard();
  }

  function renderUploadSourceCard() {
    const result = state.uploadExtractionResult || {};
    const extraction = result.extraction || {};
    const selectedName = state.selectedUploadFile?.name || result.originalFileName || 'No file selected';
    const uploadBusy = state.uploadCreateReviewLoading || state.uploadExtractionLoading || state.uploadPrepareReviewLoading;
    const canCreateReview = Boolean(state.selectedUploadFile) && !uploadBusy;
    const extractionSucceeded = Boolean(result.uploadId && extraction.success !== false && !(result.errors || []).length);
    const status = stepStatus('upload');
    const contentName = state.uploadContentName || makeContentNameFromFileName(result.originalFileName || selectedName);
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Upload Source</h4>
          <p>Choose a source file and name the knowledge before building a resource-safe import estimate.</p>
        </div>
        <span class="teacher-content-pill ${status === 'FAILED' ? 'blocked' : status === 'EXTRACTED' ? 'ready' : state.uploadCreateReviewLoading || state.uploadExtractionLoading ? 'review' : 'muted'}">${escapeHtml(status)}</span>
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
            ${uploadBusy ? 'disabled' : ''}
          >
        </label>
        <button
          type="button"
          class="small-button"
          data-upload-create-review
        ${canCreateReview ? '' : 'disabled'}
      >${state.uploadCreateReviewLoading ? 'Creating review draft...' : 'Create Review Draft'}</button>
      </div>
      ${renderUploadCreateProgress()}
      ${state.uploadCreateReviewError ? renderIssueList('Errors', [state.uploadCreateReviewError]) : ''}
      ${extractionSucceeded ? renderUploadExtractionSummary(result, extraction) : ''}
      <details class="teacher-content-upload-details" data-upload-advanced-details>
        <summary>Advanced details</summary>
        ${renderAdvancedUploadDetails(result, extraction, false)}
      </details>
    `;
  }

  function renderPreviewImportCard() {
    const result = state.uploadExtractionResult || {};
    const uploadBusy = state.uploadCreateReviewLoading || state.uploadPrepareReviewLoading;
    const canRunPreview = Boolean(result.uploadId && state.uploadImportEstimate) && !uploadBusy;
    const canRunFullImport = Boolean(result.uploadId && state.uploadPreviewComplete) && !uploadBusy;
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Preview Import</h4>
          <p>Review the resource estimate before Gemma runs.</p>
        </div>
        <span class="teacher-content-pill ${stepStatus('previewImport') === 'FAILED' ? 'blocked' : state.uploadImportEstimate ? 'ready' : state.uploadPrepareReviewLoading ? 'review' : 'muted'}">${escapeHtml(stepStatus('previewImport'))}</span>
      </div>
      ${state.uploadImportEstimate ? renderImportEstimatePanel() : '<p class="profile-empty-state">Waiting for an import estimate. Upload a source and create a review draft first.</p>'}
      <p class="teacher-content-upload-note">Gemma has not run yet. Preview Draft uses a small sample so you can check the import shape before a slower full import.</p>
      <div class="teacher-content-import-actions">
        <button type="button" class="small-button" data-upload-run-preview ${canRunPreview ? '' : 'disabled'}>${state.uploadPrepareReviewLoading && !state.uploadPreviewComplete ? 'Running Preview Draft...' : 'Run Preview Draft'}</button>
        <button type="button" class="small-button secondary-small" data-upload-run-full-import ${canRunFullImport ? '' : 'disabled'}>Run Full Import</button>
      </div>
      ${state.uploadPrepareReviewLoading || state.uploadCreateReviewTimeline.length ? renderImportActivityPanel() : ''}
    `;
  }

  function renderReviewPreviewCard() {
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Review Preview</h4>
          <p>Check temporary sample output before starting a full import.</p>
        </div>
        <span class="teacher-content-pill ${state.uploadPreviewComplete ? 'ready' : state.uploadCreateReviewError ? 'blocked' : 'muted'}">${escapeHtml(stepStatus('reviewPreview'))}</span>
      </div>
      ${state.uploadPreviewReport ? renderPreviewReportPanel() : '<p class="profile-empty-state">No preview yet. Run Preview Draft first.</p>'}
      ${state.uploadPreviewReport ? '<p class="teacher-content-upload-note">This is temporary/sample output. No final approved pack was created by preview.</p>' : ''}
      ${state.uploadPreviewReport ? '<div class="teacher-content-import-actions"><button type="button" class="small-button" data-upload-run-selected-import data-selected-import-preset="preview">Import this preview range as draft</button></div>' : ''}
      ${state.uploadPreviewReport ? renderImportActivityPanel() : ''}
    `;
  }

  function renderFullImportCard() {
    const result = state.uploadExtractionResult || {};
    const canRunFullImport = Boolean(result.uploadId && state.uploadPreviewComplete) && !state.uploadPrepareReviewLoading && !state.uploadCreateReviewLoading;
    const estimate = state.uploadImportEstimate || {};
    const largeFullImport = Boolean(estimate.isLarge);
    const fullImportConfirmed = !largeFullImport || state.fullImportConfirmText === 'CONFIRM';
    const canRunSelectedImport = Boolean(result.uploadId && state.uploadPreviewComplete) && !state.uploadPrepareReviewLoading && !state.uploadCreateReviewLoading;
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Full Import</h4>
          <p>Import one selected range at a time, or use advanced whole-packet import after preview.</p>
        </div>
        <span class="teacher-content-pill ${state.uploadPrepareReviewHandoff?.packId ? 'ready' : state.uploadPrepareReviewLoading ? 'review' : canRunFullImport ? 'ready' : 'muted'}">${escapeHtml(stepStatus('fullImport'))}</span>
      </div>
      ${renderPrepareReviewFailurePanel('full')}
      ${state.uploadPreviewComplete ? renderImportEstimatePanel() : '<p class="profile-empty-state">Run Preview Draft first.</p>'}
      ${state.uploadPreviewComplete ? '<p class="profile-empty-state" data-selected-import-recommendation>For large packets, import one section at a time to avoid overloading local Gemma.</p>' : ''}
      ${state.uploadPreviewComplete ? renderSelectedImportControls(canRunSelectedImport) : ''}
      ${state.uploadPrepareReviewLoading ? '<p class="profile-empty-state" data-full-import-running>Import is running, do not close this window.</p>' : ''}
      ${state.uploadPreviewComplete ? renderWholeImportAdvanced(canRunFullImport && fullImportConfirmed, largeFullImport) : ''}
      ${state.uploadPrepareReviewLoading || state.uploadPrepareReviewHandoff?.packId || state.uploadPrepareReviewLastFailure ? renderImportActivityPanel() : ''}
      ${renderPrepareReviewHandoff()}
      ${renderSourceMatchPanel(getCurrentSourceMatch())}
    `;
  }

  function renderStandardsCard() {
    const summary = state.report?.standardsSummary || null;
    const standardIds = Array.isArray(summary?.standardIds) ? summary.standardIds : [];
    const standards = buildStandardsPreviewItems(summary);
    const visibleStandards = filterStandardsPreviewItems(standards);
    const unknown = Array.isArray(summary?.unknown) ? summary.unknown : [];
    const missing = Array.isArray(summary?.missing) ? summary.missing : [];
    const selectedStandard = selectVisibleStandard(visibleStandards);
    if (!state.selectedDraftPackId) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Standards</h4>
            <p>Connect this knowledge pack to the standards students are expected to learn.</p>
          </div>
          <span class="teacher-content-pill muted">Coming Soon</span>
        </div>
        <p class="profile-empty-state">No draft selected. Create Review Draft from an upload or choose a draft pack to see its standards alignment.</p>
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
      ${renderStandardsTools()}
      ${renderSelectedStandardsBankSummary()}
      ${summary?.standardsBankLoaded === false ? '<p class="profile-empty-state" data-standards-bank-empty>Standards bank not loaded. Existing draft IDs are shown without bank details.</p>' : ''}
      <div class="teacher-content-metric-grid">
        ${metric('Standards Map Count', formatNumber(summary?.standardsMapCount), 'data-standards-map-count')}
        ${metric('Standard IDs Used', formatNumber(standardIds.length), 'data-standards-id-count')}
        ${metric('Unknown Standards', formatNumber(unknown.length), 'data-standards-unknown-count')}
        ${metric('Missing Standards', formatNumber(missing.length), 'data-standards-missing-count')}
      </div>
      ${standardIds.length ? renderChipList('Standard IDs', standardIds, 'data-standard-id-list') : '<p class="profile-empty-state" data-standards-empty>No standardsMap entries or standard IDs were found for this draft.</p>'}
      ${unknown.length ? renderChipList('Unknown standards found', unknown, 'data-standards-unknown-list') : ''}
      ${unknown.length ? '<p class="profile-empty-state" data-standards-unknown-bank-copy>Selected draft standard IDs are unknown in this bank.</p>' : ''}
      ${missing.length ? renderChipList('Standards used without standardsMap entries', missing, 'data-standards-missing-list') : ''}
      ${renderStandardsFilters(standards)}
      <p class="teacher-content-upload-note" data-standards-default-used>Default view: Used in this draft. Choose All standards to browse the full selected set.</p>
      ${state.selectedStandardsBankId && !standards.length ? '<p class="profile-empty-state" data-standards-bank-no-standards>Selected standards set has no standards to preview.</p>' : ''}
      ${standards.length && !visibleStandards.length ? '<p class="profile-empty-state" data-standards-filter-empty>No standards match search/filter.</p>' : ''}
      ${visibleStandards.length ? `<div class="teacher-content-standards-layout"><div class="teacher-content-standards-list">${visibleStandards.map(renderStandardCard).join('')}</div></div>${state.selectedStandardId ? renderStandardDetailPanel(selectedStandard) : ''}` : renderStandardDetailPanel(null)}
    `;
  }

  function renderStandardsTools() {
    return `
      <section class="teacher-content-standards-tools" data-standards-placeholder-controls>
        <label class="teacher-content-standards-select">
          <span>Select Saved Standards Set</span>
          <select
            id="teacherContentStandardsBankSelect"
            data-standards-bank-select
            aria-label="Select Saved Standards Set"
            ${state.standardsBankLoading ? 'disabled' : ''}
          >
            ${renderStandardsBankOptions()}
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

  function renderStandardsFilters(standards) {
    const strands = uniqueStandardValues(standards, 'strand');
    const topics = uniqueStandardValues(standards, 'topic');
    const hasBank = Boolean(state.selectedStandardsBankId);
    return `
      <section class="teacher-content-standards-filters" data-standards-filter-controls>
        <label class="teacher-content-standards-field" for="teacherContentStandardsSearch">
          <span>Search standards in this set</span>
          <input
            id="teacherContentStandardsSearch"
            type="search"
            value="${escapeAttr(state.standardsSearch)}"
            placeholder="${hasBank ? 'Search ID, code, title, text, strand, topic, keywords' : 'Select a saved standards set to search bank standards'}"
            data-standards-search
            ${hasBank ? '' : 'disabled'}
          >
        </label>
        <label class="teacher-content-standards-select" for="teacherContentStandardsStrandFilter">
          <span>Strand</span>
          <select id="teacherContentStandardsStrandFilter" data-standards-strand-filter ${strands.length ? '' : 'disabled'}>
            <option value="">${strands.length ? 'All strands' : 'No strand values available'}</option>
            ${strands.map((strand) => `<option value="${escapeAttr(strand)}" ${state.standardsStrandFilter === strand ? 'selected' : ''}>${escapeHtml(strand)}</option>`).join('')}
          </select>
        </label>
        <label class="teacher-content-standards-select" for="teacherContentStandardsTopicFilter">
          <span>Topic</span>
          <select id="teacherContentStandardsTopicFilter" data-standards-topic-filter ${topics.length ? '' : 'disabled'}>
            <option value="">${topics.length ? 'All topics' : 'No topic values available'}</option>
            ${topics.map((topic) => `<option value="${escapeAttr(topic)}" ${state.standardsTopicFilter === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}
          </select>
        </label>
        <label class="teacher-content-standards-select" for="teacherContentStandardsMatchFilter">
          <span>Draft match status</span>
          <select id="teacherContentStandardsMatchFilter" data-standards-match-filter>
            <option value="used" ${state.standardsMatchFilter === 'used' ? 'selected' : ''}>Used in this draft</option>
            <option value="all" ${state.standardsMatchFilter === 'all' ? 'selected' : ''}>All standards</option>
            <option value="unknown" ${state.standardsMatchFilter === 'unknown' ? 'selected' : ''}>Unknown in selected bank / unmatched</option>
          </select>
        </label>
      </section>
    `;
  }

  function renderStandardsPlaceholders() {
    return renderStandardsTools();
  }

  function renderStandardsBankOptions() {
    if (!state.standardsBanks.length) {
      return '<option value="">No saved standards sets found. Standards upload will be added later.</option>';
    }

    return [
      '<option value="">Choose a saved standards set</option>',
      ...state.standardsBanks.map((bank) => `
        <option value="${escapeAttr(bank.standardsBankId)}" ${bank.standardsBankId === state.selectedStandardsBankId ? 'selected' : ''}>
          ${escapeHtml(formatStandardsBankOptionLabel(bank))}
        </option>
      `)
    ].join('');
  }

  function renderSelectedStandardsBankSummary() {
    if (state.standardsBankLoading) {
      return '<p class="profile-empty-state" data-standards-bank-loading>Loading selected standards set...</p>';
    }

    if (state.standardsBankError) {
      return `<p class="profile-empty-state" data-standards-bank-error>${escapeHtml(state.standardsBankError)}</p>`;
    }

    if (!state.selectedStandardsBankId) {
      return '<p class="profile-empty-state" data-standards-bank-unselected>No saved standards set selected. Draft standard IDs are shown without saved-bank enrichment.</p>';
    }

    const selected = state.selectedStandardsBank || state.report?.selectedStandardsBank || state.standardsBanks.find((bank) => bank.standardsBankId === state.selectedStandardsBankId) || {};
    return `
      <section class="teacher-content-selected-bank" data-selected-standards-bank-summary>
        <div>
          <span>Selected Standards Set</span>
          <strong data-selected-standards-bank-title>${escapeHtml(selected.title || state.selectedStandardsBankId)}</strong>
          <small data-selected-standards-bank-id>${escapeHtml(selected.standardsBankId || state.selectedStandardsBankId)}</small>
        </div>
        <div class="teacher-content-selected-bank-meta">
          <span data-selected-standards-bank-subject>${escapeHtml(selected.subject || 'Subject not set')}</span>
          <span data-selected-standards-bank-grade>${escapeHtml(selected.gradeLevel ? `Grade ${selected.gradeLevel}` : 'Grade not set')}</span>
          <span data-selected-standards-bank-jurisdiction>${escapeHtml(selected.jurisdiction || 'Jurisdiction not set')}</span>
          <span data-selected-standards-bank-count>${formatNumber(selected.standardsCount)} standards</span>
          <span data-selected-standards-bank-validation>${selected.validationPassed === false ? 'Validation failed' : 'Validation passed'}</span>
        </div>
      </section>
    `;
  }

  function renderStandardCard(standard) {
    const vocabulary = Array.isArray(standard.relatedVocabulary) ? standard.relatedVocabulary : [];
    const concepts = Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
    const keywords = Array.isArray(standard.keywords) ? standard.keywords : [];
    const confidence = standard.confidence ? formatConfidence(standard.confidence) : null;
    const match = getStandardMatchStatus(standard);
    return `
      <section class="teacher-content-standard-card ${standard.standardId === state.selectedStandardId ? 'selected' : ''}" data-standard-card data-standard-card-id="${escapeAttr(standard.standardId || '')}" tabindex="0">
        <div class="teacher-content-standard-head">
          <div>
            <strong data-standard-id>${escapeHtml(standard.standardId || 'Standard ID not set')}</strong>
            ${standard.code ? `<span data-standard-code>${escapeHtml(standard.code)}</span>` : ''}
            ${standard.title ? `<span data-standard-title>${escapeHtml(standard.title)}</span>` : '<span data-standard-title>No title loaded for this standard.</span>'}
          </div>
          <span class="teacher-content-standard-status ${escapeAttr(match.className)}" data-standard-match-status>${escapeHtml(match.label)}</span>
          ${confidence ? `<span class="teacher-content-confidence ${escapeAttr(confidence.className)}" data-standard-confidence>${escapeHtml(confidence.label)}</span>` : ''}
        </div>
        ${standard.officialText ? `<p data-standard-official-text>${escapeHtml(standard.officialText)}</p>` : ''}
        ${standard.studentFriendlyText ? `<p data-standard-student-friendly-text>${escapeHtml(standard.studentFriendlyText)}</p>` : ''}
        ${!standard.officialText && !standard.studentFriendlyText && standard.description ? `<p data-standard-description>${escapeHtml(standard.description)}</p>` : ''}
        ${!standard.officialText && !standard.studentFriendlyText && !standard.description ? '<p data-standard-description>Only the standard ID is available for this draft.</p>' : ''}
        <div class="teacher-content-standard-meta">
          <span data-standard-bank-match>${escapeHtml(match.label)}</span>
          <span data-standard-strand>Strand: ${escapeHtml(standard.strand || 'Not loaded')}</span>
          <span data-standard-topic>Topic: ${escapeHtml(standard.topic || 'Not loaded')}</span>
          <span data-standard-review-status>Review status: ${escapeHtml(standard.reviewStatus || 'Not set')}</span>
          <span data-standard-source>Source: ${escapeHtml([standard.sourceFile, standard.sourceLocation].filter(Boolean).join(' · ') || 'Not loaded')}</span>
        </div>
        ${renderInlineChipList('Keywords', keywords, 'data-standard-keywords')}
        ${renderInlineChipList('Related vocabulary', vocabulary, 'data-standard-vocabulary')}
        ${renderInlineChipList('Related concepts', concepts, 'data-standard-concepts')}
      </section>
    `;
  }

  function renderStandardDetailPanel(standard) {
    if (!standard) {
      return '<aside class="teacher-content-standard-detail" data-standard-detail-panel><p class="profile-empty-state">Select a standard card to preview full read-only details.</p></aside>';
    }
    const keywords = Array.isArray(standard.keywords) ? standard.keywords : [];
    const vocabulary = Array.isArray(standard.relatedVocabulary) ? standard.relatedVocabulary : [];
    const concepts = Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
    const confidence = standard.confidence ? formatConfidence(standard.confidence).label : 'Not set';
    return `
      <aside class="teacher-content-standard-detail" data-standard-detail-panel>
        <span class="teacher-content-pill muted">Read Only Detail</span>
        <h5 data-standard-detail-title>${escapeHtml(standard.title || standard.standardId || 'Untitled standard')}</h5>
        <div class="teacher-content-standard-meta">
          <span data-standard-detail-id>Standard ID: ${escapeHtml(standard.standardId || 'Not set')}</span>
          <span data-standard-detail-code>Code: ${escapeHtml(standard.code || 'Not set')}</span>
          <span data-standard-detail-strand>Strand: ${escapeHtml(standard.strand || 'Not loaded')}</span>
          <span data-standard-detail-topic>Topic: ${escapeHtml(standard.topic || 'Not loaded')}</span>
          <span data-standard-detail-confidence>Confidence: ${escapeHtml(confidence)}</span>
          <span data-standard-detail-review-status>Review status: ${escapeHtml(standard.reviewStatus || 'Not set')}</span>
        </div>
        <p data-standard-detail-official-text><strong>Official text:</strong> ${escapeHtml(standard.officialText || 'Not loaded')}</p>
        <p data-standard-detail-student-friendly-text><strong>Student-friendly text:</strong> ${escapeHtml(standard.studentFriendlyText || 'Not loaded')}</p>
        ${renderInlineChipList('Keywords', keywords, 'data-standard-detail-keywords')}
        ${renderInlineChipList('Related vocabulary', vocabulary, 'data-standard-detail-vocabulary')}
        ${renderInlineChipList('Related concepts', concepts, 'data-standard-detail-concepts')}
      </aside>
    `;
  }

  function buildStandardsPreviewItems(summary) {
    const draftStandards = Array.isArray(summary?.standards) ? summary.standards : [];
    const draftById = new Map(draftStandards.map((standard) => [standard.standardId, standard]));
    const bankStandards = Array.isArray(state.selectedStandardsBank?.standards) ? state.selectedStandardsBank.standards : [];
    const bankItems = bankStandards.map((standard) => ({
      ...standard,
      ...(draftById.get(standard.standardId) || {}),
      bankMatch: true,
      usedInDraft: draftById.has(standard.standardId)
    }));
    const bankIds = new Set(bankItems.map((standard) => standard.standardId));
    const draftOnlyItems = draftStandards
      .filter((standard) => !bankIds.has(standard.standardId))
      .map((standard) => ({ ...standard, usedInDraft: true, bankMatch: Boolean(standard.bankMatch) }));
    return [...bankItems, ...draftOnlyItems];
  }

  function filterStandardsPreviewItems(standards) {
    const search = normalizeSearchText(state.standardsSearch);
    return standards.filter((standard) => {
      if (state.standardsStrandFilter && standard.strand !== state.standardsStrandFilter) return false;
      if (state.standardsTopicFilter && standard.topic !== state.standardsTopicFilter) return false;
      if (state.standardsMatchFilter === 'used' && !standard.usedInDraft) return false;
      if (state.standardsMatchFilter === 'unknown' && standard.bankMatch && standard.usedInDraft) return false;
      if (!search) return true;
      return normalizeSearchText([
        standard.standardId,
        standard.code,
        standard.title,
        standard.officialText,
        standard.studentFriendlyText,
        standard.strand,
        standard.topic,
        ...(Array.isArray(standard.keywords) ? standard.keywords : [])
      ].join(' ')).includes(search);
    });
  }

  function getStandardMatchStatus(standard) {
    if (standard.usedInDraft && standard.bankMatch) return { label: 'Used in this draft', className: 'used' };
    if (standard.usedInDraft && !standard.bankMatch) return { label: 'Unknown in selected bank', className: 'unknown' };
    return { label: 'Not used in this draft', className: 'unused' };
  }

  function selectVisibleStandard(standards) {
    if (!standards.length) return null;
    return standards.find((standard) => standard.standardId === state.selectedStandardId) || standards[0];
  }

  function uniqueStandardValues(standards, field) {
    return Array.from(new Set(standards.map((standard) => standard[field]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  }

  function normalizeSearchText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function renderDraftPackCard() {
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    if (!draft || !state.selectedDraftPackId) {
      return cardWithEmptyState('Draft Pack', 'No draft pack is selected yet. Create Review Draft from an upload or choose a draft pack to see its review summary.');
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
      ${renderSourceMatchPanel(getCurrentSourceMatch())}
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
          <p>This draft has no pending items in the current review view.</p>
          <button type="button" class="small-button secondary-small" data-review-empty-tab="approvedPacks">View Approved Packs</button>
        </section>
        ${state.selectedReviewEvidenceItem ? renderReviewEvidencePanel(state.selectedReviewEvidenceItem) : ''}
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
      ${state.selectedReviewEvidenceItem ? renderReviewEvidencePanel(state.selectedReviewEvidenceItem) : ''}
      ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
    `;
  }

  function renderReviewGroup(sectionName, items) {
    const counts = state.report?.draftPack?.reviewCountsBySection?.[sectionName] || {};
    return `
      <details class="teacher-content-review-group" data-review-section="${escapeAttr(sectionName)}">
        <summary class="teacher-content-review-group-head">
          <h5>${escapeHtml(SECTION_LABELS[sectionName])}</h5>
          <span data-review-section-pending="${escapeAttr(sectionName)}">${formatNumber(counts.pending ?? items.length)} pending</span>
          <span data-review-section-approved="${escapeAttr(sectionName)}">${formatNumber(counts.approved)} approved</span>
          <span data-review-section-rejected="${escapeAttr(sectionName)}">${formatNumber(counts.rejected)} rejected</span>
        </summary>
        ${items.length ? items.map(renderPendingItem).join('') : '<p class="profile-empty-state">No pending items in this section.</p>'}
      </details>
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
          <button type="button" class="small-button secondary-small" data-review-item-evidence data-review-evidence data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">View Evidence</button>
          <span class="sr-only" data-review-item-snippet>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</span>
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

  function renderReviewEvidencePanel(item) {
    return `
      <section class="teacher-content-review-evidence-card" data-review-evidence-card>
        <div class="teacher-content-card-head">
          <div>
            <h4>Source evidence</h4>
            <p>${escapeHtml(item.label || 'Pending item')} · ${escapeHtml(item.sourceFile || 'No source file')}</p>
          </div>
          <button type="button" class="teacher-content-close" aria-label="Close evidence" data-review-evidence-close>×</button>
        </div>
        <div class="teacher-content-detail-grid">
          ${metric('Section', SECTION_LABELS[item.section] || item.section)}
          ${metric('Index', item.index)}
          ${metric('Source', `${item.sourceFile || 'No source file'} · ${item.sourceLocation || 'No source location'}`)}
          ${metric('Confidence', formatConfidence(item.confidence).label)}
        </div>
        <section class="teacher-content-issues">
          <h5>Evidence snippet</h5>
          <p data-review-item-snippet>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        </section>
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
      return cardWithEmptyState('Import Report', 'No draft report selected. Create Review Draft from an upload or choose a draft pack to see whether it is ready to promote.');
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
      ${renderSourceMatchPanel(getCurrentSourceMatch())}
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
      ${renderCoverageReport(state.report?.coverageReport)}
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
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Approved Knowledge Packs</h4>
            <p>Approved packs are reviewed knowledge packs. Student router activation will be added in a later phase.</p>
          </div>
          <span class="teacher-content-pill muted">Empty</span>
        </div>
        <section class="teacher-content-approved-empty" data-no-approved-packs-empty-state>
          <strong>No approved knowledge packs yet.</strong>
          <p>Review imported draft content before creating approved packs.</p>
          <button type="button" class="small-button secondary-small" data-approved-empty-tab="review">View Review Content</button>
        </section>
      `;
    }

    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Approved Knowledge Packs</h4>
          <p>Approved packs are reviewed knowledge packs. Student router activation will be added in a later phase.</p>
        </div>
        <span class="teacher-content-pill ready">Approved</span>
      </div>
      <section class="teacher-content-approved-status" data-approved-pack-status-language>
        <span>Approved</span>
        <span>Indexed</span>
        <span>Not connected to student answers yet</span>
        <span>Activation setting saved</span>
      </section>
      <div class="teacher-content-approved-list">
        ${state.approved.map(renderApprovedPack).join('')}
      </div>
      ${renderApprovedSearchableSummary()}
    `;
  }

  function renderApprovedPack(pack) {
    const counts = pack.itemCounts || {};
    const indexed = pack.indexedCounts || {};
    const searchable = pack.searchableCounts || indexed;
    const indexedTotal = Object.values(indexed).reduce((sum, value) => sum + Number(value || 0), 0);
    const packId = pack.packId || '';
    const activationEnabled = pack.activationEnabled === true;
    const activationSaving = state.approvedActivationSaving[packId] === true;
    const activationMessage = state.approvedActivationMessages[packId] || '';
    const activationLabel = activationSaving ? 'Saving...' : (activationEnabled ? 'Enabled' : 'Disabled');
    return `
      <section class="teacher-content-approved-pack" data-approved-pack-card>
        <div class="teacher-content-approved-head">
          <div>
            <strong data-approved-pack-title>${escapeHtml(pack.title || pack.packId || 'Approved pack')}</strong>
            <span data-approved-pack-pack-id>${escapeHtml(pack.packId || 'No pack ID')}</span>
          </div>
          <div class="teacher-content-switch-block">
            <button type="button" class="teacher-content-switch${activationEnabled ? ' is-on' : ''}" aria-pressed="${activationEnabled ? 'true' : 'false'}" aria-label="Save approved pack activation preference" ${activationSaving || !packId ? 'disabled' : ''} data-approved-pack-toggle-action data-approved-pack-id="${escapeAttr(packId)}" data-approved-pack-activation-toggle>
              <span></span>
            </button>
            <small data-approved-pack-activation-status>${escapeHtml(activationLabel)}</small>
          </div>
        </div>
        <div class="teacher-content-approved-badges">
          <span>Approved</span>
          <span>Indexed</span>
          <span>Not connected to student answers yet</span>
          <span data-approved-pack-activation-badge>${activationEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
        <p class="teacher-content-approved-activation-note" data-approved-pack-activation-note>
          This setting is saved for future student activation. This does not change student answers yet. Student router activation will be added in a later phase.
        </p>
        <p class="teacher-content-approved-activation-message" data-approved-pack-activation-message>${escapeHtml(activationMessage)}</p>
        <div class="teacher-content-approved-meta" data-approved-pack-metadata>
          ${metadataPill('Subject', pack.subject || 'Not set', 'data-approved-pack-subject')}
          ${metadataPill('Grade level', pack.gradeLevel || 'Not set', 'data-approved-pack-grade-level')}
          ${metadataPill('Version', pack.version || 'Not set', 'data-approved-pack-version')}
          ${metadataPill('Validation status', pack.validationStatus || pack.validation || 'Not available', 'data-approved-pack-validation-status')}
          ${pack.sourcePath ? metadataPill('Source path', pack.sourcePath, 'data-approved-pack-source-path') : ''}
        </div>
        <div class="teacher-content-count-strip">
          ${countPill('Vocabulary count', counts.vocabulary, 'data-approved-pack-vocabulary-count')}
          ${countPill('Concept count', counts.concepts, 'data-approved-pack-concept-count')}
          ${countPill('Reference formula count', counts.referenceFormulas, 'data-approved-pack-reference-formula-count')}
          ${countPill('Problem bank count', counts.problemBank, 'data-approved-pack-problem-bank-count')}
          ${countPill('Standards count', counts.standardsMap, 'data-approved-pack-standards-count')}
          ${countPill('Smoke test count', counts.smokeTests, 'data-approved-pack-smoke-test-count')}
          ${countPill('Indexed total', indexedTotal, 'data-approved-pack-indexed-total')}
        </div>
        <details class="teacher-content-approved-details" data-approved-pack-details>
          <summary>Read-only pack details</summary>
          <div class="teacher-content-count-strip">
            ${countPill('Searchable vocabulary terms', searchable.vocabularyTerms, 'data-approved-pack-searchable-vocabulary-terms')}
            ${countPill('Searchable concepts', searchable.concepts, 'data-approved-pack-searchable-concepts')}
            ${countPill('Searchable problem questions', searchable.problemQuestions, 'data-approved-pack-searchable-problem-questions')}
            ${countPill('Searchable standards', searchable.standards, 'data-approved-pack-searchable-standards')}
          </div>
        </details>
      </section>
    `;
  }

  function renderApprovedSearchableSummary() {
    const searchable = state.approvedSearchableCounts || state.approvedIndexedCounts || {};
    return `
      <section class="teacher-content-counts" data-approved-searchable-summary>
        <h5>Indexed / Searchable Counts</h5>
        <div class="teacher-content-count-strip">
          ${countPill('Searchable vocabulary terms', searchable.vocabularyTerms, 'data-approved-searchable-vocabulary-terms')}
          ${countPill('Searchable concepts', searchable.concepts, 'data-approved-searchable-concepts')}
          ${countPill('Searchable problem questions', searchable.problemQuestions, 'data-approved-searchable-problem-questions')}
          ${countPill('Searchable standards', searchable.standards, 'data-approved-searchable-standards')}
        </div>
      </section>
    `;
  }

  function metadataPill(label, value, dataAttr = '') {
    return `
      <span class="teacher-content-meta-pill" ${dataAttr}>
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
      </span>
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
    const tab = TABS.find((item) => item.id === tabId);
    return tab?.shortLabel || tab?.label || 'Teacher Content';
  }

  function stepStatus(tabId) {
    if (tabId === 'upload') {
      if (state.uploadCreateReviewError) return 'FAILED';
      if (state.uploadCreateReviewLoading && state.uploadCreateReviewStage === 'Uploading file...') return 'UPLOADING';
      if (state.uploadCreateReviewLoading || state.uploadExtractionLoading) return 'EXTRACTING';
      if (state.uploadExtractionResult?.uploadId) return 'EXTRACTED';
      return 'READY';
    }
    if (tabId === 'previewImport') {
      if (state.uploadCreateReviewError) return 'FAILED';
      if (state.uploadPrepareReviewFailedMode === 'preview') return 'FAILED';
      if (state.uploadPrepareReviewLoading && !state.uploadPreviewComplete) return 'PREVIEW RUNNING';
      if (state.uploadImportEstimate) return 'ESTIMATE READY';
      return 'WAITING';
    }
    if (tabId === 'reviewPreview') {
      if (state.uploadPrepareReviewFailedMode === 'preview') return 'FAILED';
      if (state.uploadCreateReviewError) return 'FAILED';
      return state.uploadPreviewComplete ? 'PREVIEW READY' : 'NO PREVIEW';
    }
    if (tabId === 'fullImport') {
      if (state.uploadPrepareReviewHandoff?.packId) return 'COMPLETE';
      if (state.uploadPrepareReviewLoading) return 'RUNNING';
      if (state.uploadPrepareReviewFailedMode === 'full') return 'FAILED';
      if (state.uploadCreateReviewError) return 'FAILED';
      if (state.uploadPreviewComplete) return 'READY';
      return 'WAITING';
    }
    if (tabId === 'review') {
      const summary = getReviewProgressSummary(state.report?.draftPack || getSelectedDraftSummary());
      if (!summary.total) return 'NO DRAFT';
      return summary.pending ? 'PENDING REVIEW' : 'REVIEWED';
    }
    return state.approved.length ? 'AVAILABLE' : 'EMPTY';
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
    state.selectedReviewEvidenceItem = null;
    render();
  }

  function closeReviewItem() {
    state.selectedReviewItem = null;
    render();
  }

  function openReviewEvidence(button) {
    const item = findPendingItem(button.dataset.section, Number(button.dataset.index));
    if (!item) {
      state.errors.push('Review item evidence is no longer available. Refresh the draft report.');
      render();
      return;
    }

    state.selectedReviewEvidenceItem = item;
    state.selectedReviewItem = null;
    render();
  }

  function closeReviewEvidence() {
    state.selectedReviewEvidenceItem = null;
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

  async function createReviewDraftFromUpload() {
    if (!state.selectedUploadFile || state.uploadCreateReviewLoading) return;

    state.uploadCreateReviewLoading = true;
    state.uploadCreateReviewStage = 'Uploading file...';
    state.uploadCreateReviewError = '';
    state.uploadCreateReviewTimeline = makeStagedImportTimeline(IMPORT_ACTIVITY_MESSAGES.uploadReceived);
    state.uploadExtractionResult = null;
    state.uploadPrepareReviewMessage = '';
      state.uploadPrepareReviewHandoff = null;
      state.uploadImportEstimate = null;
      state.uploadPreviewReport = null;
      state.uploadPreviewComplete = false;
      state.uploadPrepareReviewFailedMode = '';
      state.uploadPrepareReviewLastFailure = null;
      state.uploadSelectedRangeStart = '1';
      state.uploadSelectedRangeEnd = '3';
      state.fullImportConfirmText = '';
      state.latestPrepareReviewSourceMatch = null;
    state.errors = [];
    setStatus('Uploading file...');
    render();

    const stageTimers = [
      window.setTimeout(() => {
        if (!state.uploadCreateReviewLoading) return;
        state.uploadCreateReviewStage = 'Extracting text...';
        appendImportActivity('extracting_text', IMPORT_ACTIVITY_MESSAGES.extractingText);
        setStatus('Extracting text...');
        render();
      }, 500),
      window.setTimeout(() => {
        if (!state.uploadCreateReviewLoading) return;
        state.uploadCreateReviewStage = 'Building import estimate...';
        appendImportActivity('import_estimate_started', 'Building import estimate');
        setStatus('Building import estimate...');
        render();
      }, 1400)
    ];

    try {
      const formData = new FormData();
      formData.append('sourceFile', state.selectedUploadFile);
      formData.append('knowledgeName', state.uploadContentName || makeContentNameFromFileName(state.selectedUploadFile.name || ''));
      const payload = await fetchJson(ENDPOINTS.uploadAndPrepare, {
        method: 'POST',
        body: formData
      });
      const data = unwrap(payload);
      applyImportTimeline(data?.timeline || payload?.timeline);
      state.uploadExtractionResult = data?.upload || data?.extraction || null;
      state.uploadImportEstimate = data?.importEstimate || null;
      state.activeTab = 'previewImport';
      state.uploadCreateReviewStage = 'Import estimate ready';
      state.uploadPrepareReviewMessage = data?.message || 'Review the import estimate, then run preview draft.';
      setStatus('Import estimate ready. Run preview draft before full import.');
    } catch (error) {
      state.uploadCreateReviewError = error.message || 'Create Review Draft failed.';
      state.uploadCreateReviewStage = '';
      applyImportTimeline(error?.data?.timeline || error?.timeline);
      appendImportActivity('error', state.uploadCreateReviewError);
      state.uploadPrepareReviewMessage = '';
      state.uploadPrepareReviewHandoff = null;
      state.errors.push(`Create Review Draft failed: ${state.uploadCreateReviewError}`);
      setStatus('Create Review Draft failed.');
    } finally {
      stageTimers.forEach((timer) => window.clearTimeout(timer));
      state.uploadCreateReviewLoading = false;
      render();
    }
  }

  async function runPreviewImport() {
    return prepareReviewFromUpload('preview');
  }

  async function runFullImport() {
    return prepareReviewFromUpload('full');
  }

  async function runSelectedImport(preset = 'range') {
    return prepareReviewFromUpload('selected', makeSelectedImportPayload(preset));
  }

  async function prepareReviewFromUpload(importMode = 'preview', extraBody = {}) {
    const uploadId = state.uploadExtractionResult?.uploadId;
    if (!uploadId || state.uploadPrepareReviewLoading) return;

    state.uploadPrepareReviewLoading = true;
    state.uploadPrepareReviewFailedMode = '';
    state.uploadPrepareReviewLastFailure = null;
    state.uploadPrepareReviewMessage = importMode === 'full'
      ? 'Import is running, do not close this window. Gemma is processing one batch at a time...'
      : importMode === 'selected'
        ? 'Importing selected pages with Gemma...'
      : 'Running a preview draft on a small sample...';
    state.errors = [];
    setStatus(importMode === 'full' ? 'Running full import...' : importMode === 'selected' ? 'Importing selected pages...' : 'Running preview draft...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.uploadPrepareReview(uploadId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packName: state.uploadContentName || makeContentNameFromFileName(state.uploadExtractionResult?.originalFileName || ''),
          retryInvalidJson: true,
          importMode,
          confirmFullImportText: importMode === 'full' ? state.fullImportConfirmText : '',
          ...extraBody
        })
      });
      const data = unwrap(payload);
      applyImportTimeline(data?.timeline || payload?.timeline);
      state.uploadImportEstimate = data?.importEstimate || state.uploadImportEstimate;
      if (data?.preview) {
        state.uploadPreviewReport = data.previewReport || null;
        state.uploadPreviewComplete = true;
        state.activeTab = 'reviewPreview';
        state.uploadPrepareReviewMessage = data?.message || 'Preview draft prepared. Review the sample before running full import.';
        setStatus('Preview draft ready.');
      } else {
        await applyPreparedDraftResponse(data);
        state.activeTab = 'review';
        setStatus(importMode === 'selected' ? 'Selected range draft prepared.' : 'Review draft prepared.');
      }
    } catch (error) {
      state.uploadPrepareReviewMessage = 'Prepare Review failed.';
      state.uploadPrepareReviewHandoff = null;
      state.uploadImportEstimate = error?.data?.importEstimate || state.uploadImportEstimate;
      state.uploadPrepareReviewFailedMode = importMode;
      state.uploadPrepareReviewLastFailure = {
        mode: importMode,
        message: error.message || 'Route error',
        teacherFriendlyError: error?.data?.teacherFriendlyError || firstError(error?.data?.errors, error.message || 'Route error'),
        technicalErrors: error?.data?.technicalErrors || [],
        errors: error?.data?.errors || [error.message || 'Route error'],
        rawModelResponsePath: error?.data?.rawModelResponsePath || '',
        failedBatches: error?.data?.failedBatches || []
      };
      applyImportTimeline(error?.data?.timeline || error?.timeline);
      state.errors.push(`Prepare Review failed: ${error.message || 'Route error'}`);
      setStatus('Prepare Review failed.');
    } finally {
      state.uploadPrepareReviewLoading = false;
      render();
    }
  }

  function makeSelectedImportPayload(preset) {
    const estimate = state.uploadImportEstimate || {};
    if (preset === 'first3') {
      state.uploadSelectedRangeStart = '1';
      state.uploadSelectedRangeEnd = String(Math.min(3, Number(estimate.pageCount || 3)));
    } else if (preset === 'next3') {
      const next = getNextThreePageRange();
      state.uploadSelectedRangeStart = String(next.start);
      state.uploadSelectedRangeEnd = String(next.end);
    } else if (preset === 'preview') {
      const pages = Number(state.uploadPreviewReport?.processedPageCount || estimate.previewMaxPages || 3);
      state.uploadSelectedRangeStart = '1';
      state.uploadSelectedRangeEnd = String(Math.min(pages, Number(estimate.pageCount || pages)));
    } else if (preset === 'firstSection') {
      return {
        selectedImport: true,
        importSelection: {
          chunkStart: 1,
          chunkEnd: 1
        }
      };
    }

    const pageStart = Math.max(1, Number(state.uploadSelectedRangeStart || 1));
    const pageEnd = Math.max(pageStart, Number(state.uploadSelectedRangeEnd || pageStart));
    return {
      selectedImport: true,
      importSelection: {
        pageStart,
        pageEnd
      }
    };
  }

  function getNextThreePageRange() {
    const maxPage = Number(state.uploadImportEstimate?.pageCount || 3);
    const currentEnd = Math.max(0, Number(state.uploadSelectedRangeEnd || state.uploadPreviewReport?.processedPageCount || 3));
    const start = Math.min(maxPage || 1, currentEnd + 1);
    const end = Math.min(maxPage || start, start + 2);
    return { start, end };
  }

  async function applyPreparedDraftResponse(data) {
    state.uploadExtractionResult = data?.upload || data?.extraction || state.uploadExtractionResult || null;
    state.uploadPrepareReviewMessage = data?.message || 'Review draft prepared.';
    state.uploadPrepareReviewHandoff = {
      packId: data?.packId || '',
      title: data?.title || data?.draftReport?.draftPack?.title || '',
      sourceMatch: data?.sourceMatch || data?.draftReport?.sourceMatch || null,
      reportRefreshFailed: false
    };
    state.latestPrepareReviewSourceMatch = data?.sourceMatch || data?.draftReport?.sourceMatch || null;
    if (data?.dashboard) state.dashboard = data.dashboard;
    if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
    if (data?.packId) state.selectedDraftPackId = data.packId;
    if (data?.draftReport) state.report = data.draftReport;
    state.selectedReviewItem = null;
    state.selectedReviewEvidenceItem = null;
    const refreshErrorsBefore = state.errors.length;
    await refreshDraftLists();
    if (data?.packId) state.selectedDraftPackId = data.packId;
    if (state.selectedDraftPackId) await loadSelectedDraftReport();
    if (state.errors.length > refreshErrorsBefore && state.uploadPrepareReviewHandoff) {
      state.uploadPrepareReviewMessage = 'Review draft prepared, but the latest report could not be refreshed.';
      state.uploadPrepareReviewHandoff.reportRefreshFailed = true;
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

  async function toggleApprovedPackActivation(button) {
    const packId = button.getAttribute('data-approved-pack-id') || '';
    if (!packId || state.approvedActivationSaving[packId]) return;

    const pack = state.approved.find((item) => item.packId === packId);
    const enabled = !(pack && pack.activationEnabled === true);
    state.approvedActivationSaving = { ...state.approvedActivationSaving, [packId]: true };
    state.approvedActivationMessages = { ...state.approvedActivationMessages, [packId]: 'Saving activation setting...' };
    setStatus('Saving activation setting...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.approvedActivation(packId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = unwrap(payload);
      state.approvedActivationMessages = {
        ...state.approvedActivationMessages,
        [packId]: data?.message || 'Activation setting saved. This does not change student answers yet.'
      };
      if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
      await refreshTeacherContentSummaries();
      setStatus('Activation setting saved. This does not change student answers yet.');
    } catch (error) {
      state.approvedActivationMessages = {
        ...state.approvedActivationMessages,
        [packId]: `Activation setting failed: ${error.message || 'Route error'}`
      };
      setStatus('Activation setting failed.');
    } finally {
      state.approvedActivationSaving = { ...state.approvedActivationSaving, [packId]: false };
      render();
    }
  }

  function applyApprovedSummary(data) {
    state.approved = Array.isArray(data?.approvedPacks) ? data.approvedPacks : [];
    state.approvedIndexedCounts = data?.indexedCounts || null;
    state.approvedSearchableCounts = data?.searchableCounts || null;
    collectApiIssues(data);
  }

  function reconcileSelectedReviewItem() {
    if (state.selectedReviewItem) {
      const next = findPendingItem(state.selectedReviewItem.section, Number(state.selectedReviewItem.index));
      state.selectedReviewItem = next || null;
    }
    if (state.selectedReviewEvidenceItem) {
      const nextEvidence = findPendingItem(state.selectedReviewEvidenceItem.section, Number(state.selectedReviewEvidenceItem.index));
      state.selectedReviewEvidenceItem = nextEvidence || null;
    }
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

  function renderImportEstimatePanel() {
    const estimate = state.uploadImportEstimate;
    if (!estimate) return '';
    const warning = estimate.hardStopMessage || estimate.warning || '';
    return `
      <section class="teacher-content-import-estimate ${estimate.isLarge ? 'large' : ''}" data-import-estimate-panel>
        <div class="teacher-content-card-head">
          <div>
            <h5>Import Estimate</h5>
            <p>Review size before Gemma runs.</p>
          </div>
          <span class="teacher-content-pill ${estimate.hardStop ? 'blocked' : estimate.isLarge ? 'review' : 'ready'}">${estimate.hardStop ? 'Large' : estimate.isLarge ? 'Confirm full import' : 'Ready'}</span>
        </div>
        <div class="teacher-content-metric-grid">
          ${metric('File Name', estimate.fileName, 'data-import-estimate-file-name')}
          ${metric('Character Count', formatNumber(estimate.characterCount), 'data-import-estimate-character-count')}
          ${metric('Page Count', formatNumber(estimate.pageCount), 'data-import-estimate-page-count')}
          ${metric('Chunk Count', formatNumber(estimate.chunkCount), 'data-import-estimate-chunk-count')}
          ${metric('Estimated Gemma Batches', formatNumber(estimate.estimatedGemmaBatches), 'data-import-estimate-batch-count')}
          ${metric('Max Chars Per Batch', formatNumber(estimate.maxCharsPerBatch), 'data-import-estimate-max-chars')}
        </div>
        ${warning ? `<p class="profile-empty-state" data-import-estimate-warning>${escapeHtml(warning)}</p>` : ''}
      </section>
    `;
  }

  function renderPreviewReportPanel() {
    const report = state.uploadPreviewReport;
    if (!report) return '';
    const counts = report.itemCounts || {};
    return `
      <section class="teacher-content-preview-report" data-import-preview-report>
        <div class="teacher-content-card-head">
          <div>
            <h5>Preview Draft</h5>
            <p>Temporary sample only. No final approved pack was created.</p>
          </div>
          <span class="teacher-content-pill ready">Preview ready</span>
        </div>
        <div class="teacher-content-metric-grid">
          ${metric('Preview Pages', formatNumber(report.processedPageCount), 'data-preview-page-count')}
          ${metric('Preview Characters', formatNumber(report.processedCharacterCount), 'data-preview-character-count')}
          ${metric('Preview Chunks', formatNumber(report.processedChunkCount), 'data-preview-chunk-count')}
          ${metric('Vocabulary', formatNumber(counts.vocabulary), 'data-preview-vocabulary-count')}
          ${metric('Concepts', formatNumber(counts.concepts), 'data-preview-concepts-count')}
          ${metric('Problems', formatNumber(counts.problemBank), 'data-preview-problem-count')}
        </div>
      </section>
    `;
  }

  function renderSelectedImportControls(canRunSelectedImport) {
    const nextRange = getNextThreePageRange();
    return `
      <section class="teacher-content-selected-import" data-selected-import-panel>
        <div class="teacher-content-card-head">
          <div>
            <h5>Import Selected Pages/Sections</h5>
            <p>Recommended for large uploads. Generated items stay pending review.</p>
          </div>
          <span class="teacher-content-pill ready">Recommended</span>
        </div>
        <div class="teacher-content-import-actions">
          <button type="button" class="small-button" data-upload-run-selected-import data-selected-import-preset="first3" ${canRunSelectedImport ? '' : 'disabled'}>Import first 3 pages</button>
          <button type="button" class="small-button secondary-small" data-upload-run-selected-import data-selected-import-preset="next3" ${canRunSelectedImport ? '' : 'disabled'}>Import next 3 pages</button>
          <button type="button" class="small-button secondary-small" data-upload-run-selected-import data-selected-import-preset="firstSection" ${canRunSelectedImport ? '' : 'disabled'}>Import first detected section</button>
        </div>
        <div class="teacher-content-range-row">
          <label class="teacher-content-name-field" for="teacherContentSelectedPageStart">
            <span>Start Page</span>
            <input id="teacherContentSelectedPageStart" type="number" min="1" value="${escapeAttr(state.uploadSelectedRangeStart || nextRange.start)}" ${canRunSelectedImport ? '' : 'disabled'}>
          </label>
          <label class="teacher-content-name-field" for="teacherContentSelectedPageEnd">
            <span>End Page</span>
            <input id="teacherContentSelectedPageEnd" type="number" min="1" value="${escapeAttr(state.uploadSelectedRangeEnd || nextRange.end)}" ${canRunSelectedImport ? '' : 'disabled'}>
          </label>
          <button type="button" class="small-button" data-upload-run-selected-import data-selected-import-preset="range" ${canRunSelectedImport ? '' : 'disabled'}>Import page range</button>
        </div>
        <p class="teacher-content-upload-note" data-selected-import-partial-note>Selected import creates a draft for only those pages/chunks and records importedPages/importedChunks metadata. It does not mark the whole packet imported.</p>
      </section>
    `;
  }

  function renderWholeImportAdvanced(canRunFullImport, largeFullImport) {
    return `
      <details class="teacher-content-whole-import-advanced" data-full-import-advanced>
        <summary>Advanced whole-packet full import</summary>
        <p class="profile-empty-state" data-full-import-gemma-warning>Whole-packet import processes every estimated batch sequentially and can overload local Gemma on large uploads.</p>
        ${largeFullImport ? `
          <label class="teacher-content-name-field" for="teacherContentFullImportConfirm" data-full-import-confirmation>
            <span>Type CONFIRM</span>
            <input id="teacherContentFullImportConfirm" type="text" value="${escapeAttr(state.fullImportConfirmText)}" placeholder="CONFIRM">
          </label>
        ` : ''}
        <div class="teacher-content-import-actions">
          <button type="button" class="small-button secondary-small" data-upload-run-full-import ${canRunFullImport ? '' : 'disabled'}>${state.uploadPrepareReviewLoading ? 'Running Full Import...' : 'Run Whole Full Import'}</button>
        </div>
      </details>
    `;
  }

  function renderPrepareReviewFailurePanel(mode) {
    const failure = state.uploadPrepareReviewLastFailure;
    if (!failure || (mode && failure.mode !== mode)) return '';
    const teacherMessage = failure.teacherFriendlyError || failure.message || 'Prepare Review failed.';
    const technical = Array.isArray(failure.technicalErrors) && failure.technicalErrors.length
      ? failure.technicalErrors
      : Array.isArray(failure.errors) ? failure.errors.slice(1) : [];
    return `
      <section class="teacher-content-issues blocked" data-full-import-failure-message>
        <h5>Full import failed</h5>
        <p>${escapeHtml(teacherMessage)}</p>
        ${Array.isArray(failure.failedBatches) && failure.failedBatches.length ? renderFailedBatchSummary(failure.failedBatches) : ''}
        ${technical.length || failure.rawModelResponsePath ? `
          <details class="teacher-content-upload-details" data-full-import-technical-details>
            <summary>Advanced details</summary>
            ${technical.length ? renderIssueList('Technical errors', technical) : ''}
            ${failure.rawModelResponsePath ? `<p class="teacher-content-upload-note">Raw model response: ${escapeHtml(failure.rawModelResponsePath)}</p>` : ''}
          </details>
        ` : ''}
      </section>
    `;
  }

  function renderFailedBatchSummary(failedBatches) {
    return `
      <div class="teacher-content-failed-batches" data-full-import-failed-batches>
        <strong>Failed page/chunk range</strong>
        ${failedBatches.map((batch) => {
          const pages = Array.isArray(batch.pages) && batch.pages.length ? `Pages ${batch.pages.join(', ')}` : '';
          const chunks = Array.isArray(batch.chunkLabels) && batch.chunkLabels.length ? batch.chunkLabels.join(', ') : '';
          return `<span>${escapeHtml([pages, chunks].filter(Boolean).join(' | ') || `Batch ${batch.batchIndex || '?'}`)}</span>`;
        }).join('')}
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
          <button type="button" class="small-button secondary-small" data-handoff-tab="review">Review Content</button>
        </div>
      </section>
    `;
  }

  function renderUploadCreateProgress() {
    const message = state.uploadCreateReviewLoading
      ? state.uploadCreateReviewStage || 'Uploading file...'
      : state.uploadCreateReviewStage || state.uploadPrepareReviewMessage || 'Create Review Draft uploads, extracts, and prepares a draft in one step.';
    const ready = message === 'Draft ready for review' || state.uploadPrepareReviewHandoff?.packId;
    return `
      <section class="teacher-content-upload-progress ${ready ? 'ready' : ''}" data-upload-create-progress>
        <span class="teacher-content-pill ${state.uploadCreateReviewLoading ? 'review' : ready ? 'ready' : 'muted'}" data-upload-create-stage>${escapeHtml(message)}</span>
      </section>
    `;
  }

  function renderImportActivityPanel() {
    const timeline = Array.isArray(state.uploadCreateReviewTimeline) ? state.uploadCreateReviewTimeline : [];
    const hasActivity = timeline.length > 0 || state.uploadCreateReviewLoading || state.uploadCreateReviewError || state.uploadPrepareReviewHandoff?.packId || state.uploadPrepareReviewLastFailure;
    if (!hasActivity) return '';
    const entries = timeline.length ? timeline : makeStagedImportTimeline('Ready to create review draft');
    const blocked = Boolean(state.uploadCreateReviewError || state.uploadPrepareReviewLastFailure);
    return `
      <section class="teacher-content-import-activity" data-import-activity-panel aria-label="Gemma Draft Activity">
        <div class="teacher-content-card-head">
          <div>
            <h5>Gemma Draft Activity</h5>
            <p>Operational import progress for this teacher draft.</p>
          </div>
          <span class="teacher-content-pill ${blocked ? 'blocked' : state.uploadCreateReviewLoading || state.uploadPrepareReviewLoading ? 'review' : 'ready'}">${blocked ? 'Error' : state.uploadCreateReviewLoading || state.uploadPrepareReviewLoading ? 'Working' : 'Ready'}</span>
        </div>
        <ol class="teacher-content-import-activity-list">
          ${entries.map(renderImportActivityEntry).join('')}
        </ol>
      </section>
    `;
  }

  function renderImportActivityEntry(entry) {
    const message = entry && entry.message ? entry.message : 'Import activity updated';
    const details = renderImportActivityDetails(entry && entry.details);
    const blocked = entry && entry.type === 'error';
    return `
      <li class="${blocked ? 'blocked' : ''}" data-import-activity-event>
        <span>${escapeHtml(message)}</span>
        ${details}
      </li>
    `;
  }

  function renderImportActivityDetails(details) {
    if (!details || typeof details !== 'object') return '';
    const parts = [];
    if (details.fileName) parts.push(`File: ${details.fileName}`);
    if (details.characterCount !== undefined) parts.push(`Characters: ${formatNumber(details.characterCount)}`);
    if (details.pageCount !== undefined) parts.push(`Pages: ${formatNumber(details.pageCount)}`);
    if (details.chunkCount !== undefined) parts.push(`Chunks: ${formatNumber(details.chunkCount)}`);
    if (details.pageRange) parts.push(`Selected pages: ${details.pageRange}`);
    if (details.chunkRange) parts.push(`Selected chunks: ${details.chunkRange}`);
    if (details.batchIndex && details.totalBatches) parts.push(`Batch ${details.batchIndex} of ${details.totalBatches}`);
    if (details.retryIndex && details.retryTotal) parts.push(`Retry ${details.retryIndex} of ${details.retryTotal}`);
    if (details.retryMaxCharacters) parts.push(`Retry limit: ${formatNumber(details.retryMaxCharacters)} chars`);
    if (Array.isArray(details.chunkLabels) && details.chunkLabels.length) parts.push(`Source: ${details.chunkLabels.join(', ')}`);
    if (Array.isArray(details.errors) && details.errors.length) parts.push(`Reason: ${details.errors.join('; ')}`);
    const itemCounts = details.itemCounts && typeof details.itemCounts === 'object' ? details.itemCounts : null;
    if (itemCounts) {
      const countText = Object.entries(itemCounts)
        .filter(([, value]) => Number(value) > 0)
        .map(([key, value]) => `${titleCase(key)}: ${value}`)
        .join(', ');
      if (countText) parts.push(countText);
    }
    if (!parts.length) return '';
    return `<small>${escapeHtml(parts.join(' | '))}</small>`;
  }

  function makeStagedImportTimeline(message) {
    return [{
      type: 'staged',
      message,
      details: {}
    }];
  }

  function appendImportActivity(type, message, details = {}) {
    const timeline = Array.isArray(state.uploadCreateReviewTimeline) ? state.uploadCreateReviewTimeline : [];
    if (timeline.some((entry) => entry && entry.type === type && entry.message === message)) return;
    state.uploadCreateReviewTimeline = [
      ...timeline,
      { type, message, details }
    ];
  }

  function applyImportTimeline(timeline) {
    if (!Array.isArray(timeline) || !timeline.length) return;
    state.uploadCreateReviewTimeline = dedupeTimelineEntries(timeline)
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        type: String(entry.type || 'activity'),
        message: String(entry.message || 'Import activity updated'),
        details: entry.details && typeof entry.details === 'object' ? entry.details : {}
      }));
  }

  function dedupeTimelineEntries(timeline) {
    const entries = [];
    timeline.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const key = `${entry.type || 'activity'}:${entry.message || ''}`;
      const existingIndex = entries.findIndex((candidate) => `${candidate.type || 'activity'}:${candidate.message || ''}` === key);
      if (existingIndex < 0) {
        entries.push(entry);
      } else {
        entries[existingIndex] = timelineDetailScore(entry.details) >= timelineDetailScore(entries[existingIndex].details)
          ? entry
          : entries[existingIndex];
      }
    });
    return entries;
  }

  function timelineDetailScore(details) {
    if (!details || typeof details !== 'object') return 0;
    return Number(details.pageCount || 0)
      + Number(details.chunkCount || 0)
      + Number(details.characterCount || 0) / 100000;
  }

  function renderUploadExtractionSummary(result, extraction) {
    return `
      <section class="teacher-content-upload-summary" data-upload-source-summary>
        <div class="teacher-content-metric-grid">
          ${metric('Original File', result.originalFileName || state.selectedUploadFile?.name || 'Not selected')}
          ${metric('Extraction Status', extraction.success === false ? 'Failed' : 'Extracted')}
          ${metric('Character Count', formatNumber(result.characterCount ?? extraction.characterCount))}
          ${metric('Page Count', formatNumber(result.pageCount ?? extraction.pageCount))}
        </div>
      </section>
    `;
  }

  function renderAdvancedUploadDetails(result, extraction, includeWrapper = true) {
    const hasDetails = Boolean(
      result.originalFileName
      || state.selectedUploadFile?.name
      || result.fileType
      || extraction.detectedType
      || result.characterCount
      || extraction.characterCount
      || (Array.isArray(result.warnings) && result.warnings.length)
      || (Array.isArray(extraction.warnings) && extraction.warnings.length)
      || (Array.isArray(result.errors) && result.errors.length)
      || (Array.isArray(extraction.errors) && extraction.errors.length)
    );
    if (!hasDetails) return '';

    const details = `
        <div class="teacher-content-metric-grid">
          ${metric('Original File', result.originalFileName || state.selectedUploadFile?.name || 'Not selected')}
          ${metric('File Type', result.fileType || extraction.detectedType || 'Not selected')}
          ${metric('Extraction Status', state.uploadCreateReviewLoading || state.uploadExtractionLoading ? 'In progress' : passFail(extraction.success))}
          ${metric('Character Count', formatNumber(result.characterCount ?? extraction.characterCount))}
          ${metric('Sections Found', formatNumber(result.sectionsCount ?? extraction.sectionsCount))}
          ${metric('Tables Found', formatNumber(result.tablesCount ?? extraction.tablesCount))}
        </div>
        ${renderIssueList('Warnings', result.warnings || extraction.warnings)}
        ${renderIssueList('Errors', result.errors || extraction.errors)}
    `;
    if (!includeWrapper) return details;
    return `
      <details class="teacher-content-advanced-details" data-upload-advanced-details>
        <summary>Advanced details</summary>
        ${details}
      </details>
    `;
  }

  function renderSourceMatchPanel(sourceMatch) {
    if (!sourceMatch) return '';
    const mismatch = sourceMatch.status === 'mismatch' || isPreparedDraftSelectionMismatch(sourceMatch);
    const draftSourceFiles = Array.isArray(sourceMatch.draftSourceFiles) ? sourceMatch.draftSourceFiles : [];
    const status = mismatch ? 'mismatch' : (sourceMatch.status || 'unknown');
    const statusLabel = status === 'matched' ? 'Source matched' : status === 'mismatch' ? 'Source mismatch warning' : 'Source match unknown';
    return `
      <section class="teacher-content-source-match ${mismatch ? 'blocked' : ''}" data-source-match-metadata>
        <div class="teacher-content-card-head">
          <div>
            <h5>Source match</h5>
            <p data-source-match-status>${escapeHtml(statusLabel)}</p>
          </div>
          <span class="teacher-content-pill ${mismatch ? 'blocked' : status === 'matched' ? 'ready' : 'muted'}">${escapeHtml(statusLabel)}</span>
        </div>
        ${mismatch ? `<p class="profile-empty-state" data-source-match-warning>${escapeHtml(sourceMatch.warning || 'Selected draft source files do not appear to match the uploaded source.')}</p>` : ''}
        <div class="teacher-content-detail-grid">
          ${metric('Uploaded File', sourceMatch.uploadedFileName || sourceMatch.originalFileName || 'Not available', 'data-source-match-uploaded-file')}
          ${metric('Generated Draft ID', sourceMatch.draftPackId || state.uploadPrepareReviewHandoff?.packId || state.selectedDraftPackId, 'data-source-match-draft-id')}
          ${metric('Generated Draft Title', sourceMatch.draftTitle || state.report?.draftPack?.title || 'Not available', 'data-source-match-draft-title')}
          ${metric('Extraction Characters', formatNumber(sourceMatch.extractionCharacterCount), 'data-source-match-character-count')}
          ${metric('Page / Chunk Count', `${formatNumber(sourceMatch.pageCount)} pages / ${formatNumber(sourceMatch.chunkCount)} chunks`, 'data-source-match-page-chunk-count')}
        </div>
        ${renderChipList('Source files inside draft', draftSourceFiles, 'data-source-match-draft-source-files')}
      </section>
    `;
  }

  function getCurrentSourceMatch() {
    if (
      state.latestPrepareReviewSourceMatch
      && state.uploadPrepareReviewHandoff?.packId
      && state.uploadPrepareReviewHandoff.packId === state.selectedDraftPackId
    ) {
      return state.latestPrepareReviewSourceMatch;
    }

    if (
      state.latestPrepareReviewSourceMatch
      && state.uploadPrepareReviewHandoff?.packId
      && state.uploadPrepareReviewHandoff.packId !== state.selectedDraftPackId
    ) {
      return {
        ...state.latestPrepareReviewSourceMatch,
        draftPackId: state.selectedDraftPackId,
        draftTitle: state.report?.draftPack?.title || getSelectedDraftSummary()?.title || '',
        draftSourceFiles: state.report?.sourceMatch?.draftSourceFiles || [],
        status: 'mismatch',
        warning: 'The selected draft is not the draft generated from the uploaded source.'
      };
    }

    return state.report?.sourceMatch || null;
  }

  function isPreparedDraftSelectionMismatch(sourceMatch) {
    return Boolean(
      state.uploadPrepareReviewHandoff?.packId
      && state.selectedDraftPackId
      && state.uploadPrepareReviewHandoff.packId !== state.selectedDraftPackId
      && sourceMatch.uploadedFileName
    );
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

  function renderCoverageReport(coverage) {
    if (!coverage) return '';
    const itemCounts = coverage.itemCounts || {};
    return `
      <section class="teacher-content-counts" data-import-coverage-report>
        <h5>Coverage report</h5>
        <div class="teacher-content-count-strip">
          ${countPill('Total pages', coverage.totalPages, 'data-import-coverage-total-pages')}
          ${countPill('Total chunks', coverage.totalChunks, 'data-import-coverage-total-chunks')}
          ${countPill('Processed chunks', coverage.processedChunks, 'data-import-coverage-processed-chunks')}
          ${countPill('Chunks with items', coverage.chunksWithDraftItems, 'data-import-coverage-chunks-with-items')}
          ${countPill('Chunks without items', coverage.chunksWithNoExtractedKnowledge, 'data-import-coverage-empty-chunks')}
        </div>
        ${renderCounts('Draft item counts by section', itemCounts)}
        ${renderChipList('Sections detected', coverage.sectionsDetected || [], 'data-import-coverage-sections-detected')}
        ${renderChipList('Chunks with no extracted knowledge', coverage.noKnowledgeChunks || [], 'data-import-coverage-empty-chunk-list')}
        ${renderFailedBatchList(coverage.failedBatches || [])}
      </section>
    `;
  }

  function renderFailedBatchList(failedBatches) {
    const list = Array.isArray(failedBatches) ? failedBatches.filter(Boolean) : [];
    if (!list.length) return '';
    return `
      <div class="teacher-content-failed-batches" data-import-coverage-failed-batches>
        <h6>Failed model batches</h6>
        <ul>
          ${list.map((batch) => {
            const labels = Array.isArray(batch.chunkLabels) && batch.chunkLabels.length ? batch.chunkLabels.join(', ') : 'Source chunk unavailable';
            const errors = Array.isArray(batch.errors) && batch.errors.length ? ` - ${batch.errors.join('; ')}` : '';
            return `<li>Batch ${escapeHtml(batch.batchIndex || '?')}: ${escapeHtml(labels)}${escapeHtml(errors)}</li>`;
          }).join('')}
        </ul>
      </div>
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

  function firstError(errors, fallback) {
    return Array.isArray(errors) && errors.length ? String(errors[0]) : fallback;
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

  function formatStandardsBankOptionLabel(bank) {
    const parts = [
      bank.title || bank.standardsBankId || 'Untitled standards set',
      bank.subject,
      bank.gradeLevel ? `Grade ${bank.gradeLevel}` : '',
      bank.jurisdiction
    ].filter(Boolean);
    return parts.join(' - ');
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
