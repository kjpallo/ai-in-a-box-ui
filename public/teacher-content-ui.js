(() => {
  const ENDPOINTS = {
    dashboard: '/api/teacher-content/dashboard',
    uploadExtract: '/api/teacher-content/uploads/extract',
    uploadAndPrepare: '/api/teacher-content/uploads/upload-and-prepare',
    uploadPrepareReview: (uploadId) => `/api/teacher-content/uploads/${encodeURIComponent(uploadId)}/prepare-review`,
    uploadHistory: '/api/teacher-content/uploads/history',
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
    approvedActivation: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}/activation`,
    approvedDelete: (packId) => `/api/teacher-content/approved/${encodeURIComponent(packId)}`,
    approvedBulkDelete: '/api/teacher-content/approved'
  };

  const TABS = [
    { id: 'upload', label: 'Upload / Start', shortLabel: 'Upload / Start' },
    { id: 'review', label: 'Review Draft Content', shortLabel: 'Review Draft Content' },
    { id: 'complete', label: 'Done', shortLabel: 'Done' }
  ];

  const SECTION_LABELS = {
    vocabulary: 'Vocabulary',
    concepts: 'Concepts',
    referenceFormulas: 'Reference formulas',
    problemBank: 'Problem-bank items',
    examples: 'Examples',
    misconceptions: 'Misconceptions',
    standardsMap: 'Standards suggestions',
    smokeTests: 'Warnings / needs repair'
  };

  const REVIEW_GROUP_ORDER = [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'examples',
    'misconceptions',
    'standardsMap',
    'smokeTests'
  ];
  const REVIEW_COUNTED_SECTIONS = [
    'vocabulary',
    'concepts',
    'referenceFormulas',
    'problemBank',
    'standardsMap',
    'smokeTests'
  ];
  const REVIEW_PRIMARY_DRAFT_SECTIONS = [
    'vocabulary',
    'concepts',
    'referenceFormulas'
  ];
  const IMPORT_PROFILES = [
    { value: 'general', label: 'General' },
    { value: 'physical_science', label: 'Science' },
    { value: 'math', label: 'Math' },
    { value: 'english_reading', label: 'English / Reading' },
    { value: 'history_social_studies', label: 'History / Social Studies' },
    { value: 'art', label: 'Art' },
    { value: 'computer_science', label: 'Computer Science' },
    { value: 'robotics', label: 'Robotics' },
    { value: 'procedures_class_info', label: 'Class Info / Procedures' }
  ];

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
  const PAUSED_STANDARDS_WARNING_PATTERNS = [
    /standardsmap is empty/i,
    /smoketests is empty/i
  ];

  const state = {
    initialized: false,
    loadedOnce: false,
    loadPromise: null,
    managerObserver: null,
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
    uploadedSources: [],
    approvedIndexedCounts: null,
    approvedSearchableCounts: null,
    approvedActivationSaving: {},
    approvedActivationMessages: {},
    approvedDeleteSaving: {},
    approvedDeleteMessages: {},
    selectedApprovedPackIds: [],
    approvedBulkDeleteSaving: false,
    approvedBulkDeleteMessage: '',
    report: null,
    selectedReviewItem: null,
    selectedReviewEvidenceItem: null,
    selectedReviewItemKeys: [],
    reviewListFilter: 'all',
    reviewNeedsReviewExpanded: false,
    reviewCompleted: false,
    reviewBulkMessage: '',
    reviewActionLoading: false,
    promotionActionLoading: false,
    promotionMessage: '',
    selectedUploadFile: null,
    selectedUploadFiles: [],
    uploadQueue: [],
    uploadQueueRunning: false,
    uploadQueueCancelRequested: false,
    uploadFolderPathDebugNote: '',
    uploadExtractionLoading: false,
    uploadCreateReviewLoading: false,
    uploadCreateReviewStage: '',
    uploadCreateReviewError: '',
    uploadCreateReviewTimeline: [],
    uploadProgress: {
      label: 'Ready',
      detail: '',
      percent: 0,
      tone: 'idle'
    },
    uploadProgressError: null,
    uploadExtractionResult: null,
    uploadContentName: '',
    uploadImportProfile: '',
    uploadImportProfileError: '',
    uploadImportProfileNeedsAttention: false,
    uploadPrepareReviewLoading: false,
    uploadPrepareReviewAbortController: null,
    uploadPrepareReviewRequestId: '',
    uploadPrepareReviewStopped: false,
    uploadPrepareReviewMessage: '',
    uploadPrepareReviewHandoff: null,
    uploadImportEstimate: null,
    uploadAutoImportPlan: null,
    uploadPreviewReport: null,
    uploadPreviewComplete: false,
    uploadPreviewPartial: false,
    uploadPreviewSize: 'ultraSafe',
    uploadPreviewPageStart: '1',
    uploadPreviewPageEnd: '1',
    uploadPreviewAutoTextPage: true,
    uploadPreviewCustomMaxChars: '1000',
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

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/["\\]/g, '\\$&');
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
            <p>Upload and review draft content before publishing student-ready knowledge packs.</p>
          </div>
          <button type="button" id="teacherContentClose" class="teacher-content-close" aria-label="Close Teacher Content" data-teacher-content-close>×</button>
        </div>

        <div class="teacher-content-status-row">
          <span id="teacherContentLoadStatus">Ready to load teacher content.</span>
          <span>Import workflow only: Upload / Start, Review Draft Content, Done.</span>
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
    watchForManagerShell();
    render();
    loadTeacherContent();
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

      const reviewCancel = event.target.closest('[data-review-cancel]');
      if (reviewCancel) {
        event.preventDefault();
        cancelReviewWorkflow();
        return;
      }

      const reviewSelectAll = event.target.closest('[data-review-select-all]');
      if (reviewSelectAll) {
        event.preventDefault();
        toggleSelectAllVisibleReviewItems();
        return;
      }

      const reviewFilter = event.target.closest('[data-review-filter]');
      if (reviewFilter) {
        event.preventDefault();
        setReviewListFilter(reviewFilter.getAttribute('data-review-filter'));
        return;
      }

      const reviewNeedsReviewToggle = event.target.closest('[data-review-needs-review-toggle]');
      if (reviewNeedsReviewToggle) {
        event.preventDefault();
        state.reviewNeedsReviewExpanded = !state.reviewNeedsReviewExpanded;
        render();
        return;
      }

      const acceptSelected = event.target.closest('[data-review-accept-selected]');
      if (acceptSelected) {
        event.preventDefault();
        acceptSelectedReviewItems();
        return;
      }

      const acceptAll = event.target.closest('[data-review-accept-all]');
      if (acceptAll) {
        event.preventDefault();
        acceptAllReviewItems();
        return;
      }

      const reviewPackSelect = event.target.closest('[data-review-pack-select]');
      if (reviewPackSelect) {
        event.preventDefault();
        selectReviewQueuePack(reviewPackSelect.getAttribute('data-review-pack-id') || '');
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

      const uploadBrowseFolder = event.target.closest('[data-upload-browse-folder]');
      if (uploadBrowseFolder) {
        event.preventDefault();
        byId('teacherContentUploadFolder')?.click();
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

      const recommendedImport = event.target.closest('[data-upload-run-recommended-import]');
      if (recommendedImport) {
        event.preventDefault();
        runRecommendedImport();
        return;
      }

      const previewRangeButton = event.target.closest('[data-preview-range-mode]');
      if (previewRangeButton) {
        event.preventDefault();
        applyPreviewRangeMode(previewRangeButton.getAttribute('data-preview-range-mode') || 'page1');
        return;
      }

      const retryPreview = event.target.closest('[data-upload-retry-preview]');
      if (retryPreview) {
        event.preventDefault();
        retryPreviewWithSmallerLimit();
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

      const stopGeneration = event.target.closest('[data-upload-stop-generation]');
      if (stopGeneration) {
        event.preventDefault();
        stopUploadGeneration();
        return;
      }

      const cancelRemaining = event.target.closest('[data-upload-cancel-remaining]');
      if (cancelRemaining) {
        event.preventDefault();
        cancelRemainingUploadQueue();
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

      const doneViewKnowledgePacks = event.target.closest('[data-review-done-view-knowledge-packs]');
      if (doneViewKnowledgePacks) {
        event.preventDefault();
        focusKnowledgeManager();
        return;
      }

      const draftViewEdit = event.target.closest('[data-draft-pack-view-edit-action]');
      if (draftViewEdit) {
        event.preventDefault();
        openDraftPackForReview(draftViewEdit.getAttribute('data-draft-pack-id') || '');
        return;
      }

      const draftDelete = event.target.closest('[data-draft-pack-delete-action]');
      if (draftDelete) {
        event.preventDefault();
        setStatus('Draft delete is not available in this view. Drafts stay available for review.');
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
        if (approvedActivationToggle.matches('input[type="checkbox"]')) return;
        event.preventDefault();
        toggleApprovedPackActivation(approvedActivationToggle);
        return;
      }

      const approvedDelete = event.target.closest('[data-approved-pack-delete-action]');
      if (approvedDelete) {
        event.preventDefault();
        deleteApprovedPack(approvedDelete);
        return;
      }

      const approvedBulkDelete = event.target.closest('[data-approved-pack-bulk-delete-action]');
      if (approvedBulkDelete) {
        event.preventDefault();
        deleteSelectedApprovedPacks();
        return;
      }

      const approvedViewEdit = event.target.closest('[data-approved-pack-view-edit-action]');
      if (approvedViewEdit) {
        event.preventDefault();
        toggleApprovedPackDetails(approvedViewEdit);
      }
    });

    byId('teacherContentBack')?.addEventListener('click', () => shiftTab(-1));
    byId('teacherContentNext')?.addEventListener('click', () => shiftTab(1));
    document.addEventListener('change', (event) => {
      if (event.target?.id === 'teacherContentDraftSelect') {
        state.selectedDraftPackId = event.target.value || '';
        clearDraftScopedReviewUiState();
        loadSelectedDraftReport().then(() => {
          render();
        });
        return;
      }

      if (event.target?.id === 'teacherContentStandardsBankSelect') {
        selectStandardsBank(event.target.value || '');
        return;
      }

      if (event.target?.matches('[data-review-selection-checkbox]')) {
        updateReviewSelection(event.target);
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

      if (event.target?.matches?.('[data-approved-pack-activation-checkbox]')) {
        toggleApprovedPackActivation(event.target);
        return;
      }

      if (event.target?.matches?.('[data-approved-pack-select-checkbox]')) {
        toggleApprovedPackSelection(event.target);
        return;
      }

      if (event.target?.id !== 'teacherContentUploadFile' && event.target?.id !== 'teacherContentUploadFolder') return;
      applySelectedUploadFiles(Array.from(event.target.files || []));
      if (event.target?.id === 'teacherContentUploadFolder') {
        const fileInput = byId('teacherContentUploadFile');
        if (fileInput) fileInput.value = '';
      } else {
        const folderInput = byId('teacherContentUploadFolder');
        if (folderInput) folderInput.value = '';
      }
    });

    document.addEventListener('input', (event) => {
      if (event.target?.id === 'teacherContentKnowledgeName') {
        state.uploadContentName = event.target.value || '';
        if (state.uploadQueue.length === 1) {
          state.uploadQueue[0] = {
            ...state.uploadQueue[0],
            proposedPackName: state.uploadContentName || state.uploadQueue[0].proposedPackName
          };
        }
        render();
        return;
      }
      if (event.target?.id === 'teacherContentImportProfile') {
        state.uploadImportProfile = normalizeImportProfileSelection(event.target.value);
        if (state.uploadImportProfile) {
          state.uploadImportProfileError = '';
          state.uploadImportProfileNeedsAttention = false;
        }
        render();
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

      if (event.target?.id === 'teacherContentPreviewSize') {
        state.uploadPreviewSize = event.target.value || 'ultraSafe';
        if (state.uploadPreviewSize === 'ultraSafe' && getFirstTextPage() > 1) {
          applyDefaultPreviewTextPage();
        }
        render();
        return;
      }

      if (event.target?.id === 'teacherContentPreviewPageStart') {
        state.uploadPreviewPageStart = event.target.value || '';
        if (state.uploadPreviewSize !== 'range') state.uploadPreviewPageEnd = event.target.value || '';
        state.uploadPreviewAutoTextPage = false;
        return;
      }

      if (event.target?.id === 'teacherContentPreviewPageEnd') {
        state.uploadPreviewPageEnd = event.target.value || '';
        state.uploadPreviewAutoTextPage = false;
        return;
      }

      if (event.target?.id === 'teacherContentPreviewMaxChars') {
        state.uploadPreviewCustomMaxChars = event.target.value || '';
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

  function watchForManagerShell() {
    if (state.managerObserver || byId('teacherContentKnowledgeManager') || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver(() => {
      if (!byId('teacherContentKnowledgeManager')) return;
      observer.disconnect();
      state.managerObserver = null;
      render();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    state.managerObserver = observer;
  }

  function applySelectedUploadFiles(files = []) {
    state.selectedUploadFiles = files;
    state.selectedUploadFile = files[0] || null;
    const singleDefaultName = files.length === 1 && files[0]
      ? buildDefaultPackNameFromFile(files[0], files[0].name || '')
      : '';
    const hasFolderSelection = files.length > 1;
    const hasFolderPathInfo = files.some((file) => String(file?.webkitRelativePath || file?.relativePath || '').trim().length > 0);
    state.uploadFolderPathDebugNote = hasFolderSelection && !hasFolderPathInfo
      ? 'Folder path data was not available from this browser, so pack names used file names only.'
      : '';
    state.uploadContentName = singleDefaultName;
    state.uploadImportProfileError = '';
    state.uploadImportProfileNeedsAttention = false;
    state.uploadQueue = buildUploadQueueFromFiles(files, singleDefaultName);
    state.uploadQueueRunning = false;
    state.uploadQueueCancelRequested = false;
    state.uploadExtractionResult = null;
    state.uploadPrepareReviewMessage = '';
    state.uploadCreateReviewStage = '';
    state.uploadCreateReviewError = '';
    state.uploadCreateReviewTimeline = [];
    setUploadProgress('Ready', '', 0, 'idle');
    clearUploadProgressError();
    state.uploadPrepareReviewHandoff = null;
    state.uploadImportEstimate = null;
    state.uploadAutoImportPlan = null;
    state.uploadPreviewReport = null;
    state.uploadPreviewComplete = false;
    state.uploadPreviewPartial = false;
    state.uploadPreviewSize = 'ultraSafe';
    state.uploadPreviewPageStart = '1';
    state.uploadPreviewPageEnd = '1';
    state.uploadPreviewAutoTextPage = true;
    state.uploadPreviewCustomMaxChars = '1000';
    state.uploadPrepareReviewFailedMode = '';
    state.uploadPrepareReviewLastFailure = null;
    state.uploadSelectedRangeStart = '1';
    state.uploadSelectedRangeEnd = '3';
    state.fullImportConfirmText = '';
    state.latestPrepareReviewSourceMatch = null;
    state.reviewCompleted = false;
    render();
  }

  async function loadTeacherContent() {
    if (state.loadPromise) return state.loadPromise;
    if (state.loadedOnce) {
      render();
      return null;
    }
    state.loadPromise = (async () => {
    state.loading = true;
    state.errors = [];
    setStatus('Loading teacher content...');
    render();

    const [dashboardResult, draftsResult, standardsBanksResult, approvedResult, uploadHistoryResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.standardsBanks),
      fetchJson(ENDPOINTS.approved),
      fetchJson(ENDPOINTS.uploadHistory)
    ]);

    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(standardsBanksResult, 'standardsBanks');
    applySettledResult(approvedResult, 'approved');
    applySettledResult(uploadHistoryResult, 'uploadHistory');

    if (!state.selectedDraftPackId && state.drafts.length) {
      state.selectedDraftPackId = state.drafts[0].packId || '';
    }

    await loadSelectedDraftReport();

    state.loading = false;
    state.loadedOnce = true;
    render();
    })();
    try {
      await state.loadPromise;
    } finally {
      state.loadPromise = null;
    }
    return null;
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

    if (kind === 'uploadHistory') {
      state.uploadedSources = Array.isArray(data?.uploadedSources) ? data.uploadedSources : [];
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
    clearDraftScopedReviewUiState();
    setStatus('Loading selected draft report...');

    try {
      const data = unwrap(await fetchJson(ENDPOINTS.draftReport(state.selectedDraftPackId, state.selectedStandardsBankId)));
      state.report = data || null;
      clearStaleReviewCanceledMessage();
      reconcileSelectedReviewItem();
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
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    errors.forEach((item) => {
      if (typeof item === 'string') {
        state.errors.push(item);
      } else if (Array.isArray(item?.errors)) {
        state.errors.push(...item.errors);
      }
    });
  }

  function render() {
    renderTabs();
    renderDeck();
    renderKnowledgeManager();
    renderDraftSelect();
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
        ${(state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading) && tab.id !== state.activeTab ? 'disabled' : ''}
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

  function renderKnowledgeManager() {
    const manager = byId('teacherContentKnowledgeManager');
    if (!manager) return;
    const hasPacks = state.approved.length || state.drafts.length;
    manager.innerHTML = `
      <div class="teacher-content-card-head">
        <div>
          <h4>Saved Knowledge Packs</h4>
          <p>Toggle which packs can be used for student answers, or edit/delete packs.</p>
        </div>
      </div>
      ${hasPacks ? `<div class="teacher-content-simple-pack-list" data-knowledge-pack-list>${renderSimpleKnowledgePackRows()}</div>` : `
        <section class="teacher-content-approved-empty" data-no-approved-packs-empty-state data-knowledge-packs-blade>
          <strong>No knowledge packs yet.</strong>
          <p>Use Build Knowledge Pack to upload and review content first.</p>
        </section>
      `}
    `;
  }

  function renderSimpleKnowledgePackRows() {
    const approvedRows = state.approved.map((pack) => renderApprovedPack(pack));
    const draftRows = state.drafts.map((draft) => renderDraftPack(draft));
    return [...approvedRows, ...draftRows].join('');
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
    if (tabId === 'complete') return renderReviewDoneCard();
    return cardWithEmptyState('Done', 'Complete review to finish this workflow.');
  }

  function renderUploadSourceCard() {
    const result = state.uploadExtractionResult || {};
    const extraction = result.extraction || {};
    const selectedName = formatSelectedUploadLabel();
    const uploadBusy = state.uploadCreateReviewLoading || state.uploadExtractionLoading || state.uploadPrepareReviewLoading;
    const hasProfileSelection = Boolean(state.uploadImportProfile);
    const canAttemptCreateReview = state.selectedUploadFiles.length > 0 && !uploadBusy;
    const extractionSucceeded = Boolean(result.uploadId && extraction.success !== false && !(result.errors || []).length);
    const status = stepStatus('upload');
    const contentName = state.uploadContentName || makeContentNameFromFileName(result.originalFileName || state.selectedUploadFile?.name || '');
    const hasTechnicalDetails = extractionSucceeded
      || state.uploadAutoImportPlan
      || state.uploadImportEstimate
      || state.uploadCreateReviewTimeline.length
      || state.uploadPrepareReviewLastFailure
      || state.uploadProgressError;
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Upload / Start</h4>
          <p>Upload a source file, name the knowledge pack, and start analysis.</p>
        </div>
        <span class="teacher-content-pill ${status === 'FAILED' ? 'blocked' : status === 'EXTRACTED' ? 'ready' : state.uploadCreateReviewLoading || state.uploadExtractionLoading ? 'review' : 'muted'}">${escapeHtml(status)}</span>
      </div>
      <div class="teacher-content-upload-row">
        <input
          id="teacherContentUploadFile"
          class="sr-only"
          type="file"
          multiple
          accept=".txt,.csv,.json,.docx,.xlsx,.pptx,.pdf"
          data-upload-file-input
        >
        <input
          id="teacherContentUploadFolder"
          class="sr-only"
          type="file"
          multiple
          webkitdirectory
          directory
          accept=".txt,.csv,.json,.docx,.xlsx,.pptx,.pdf"
          data-upload-folder-input
        >
        <button type="button" class="small-button" data-upload-browse>Browse</button>
        <button type="button" class="small-button secondary-small" data-upload-browse-folder>Upload Folder</button>
        <div class="teacher-content-file-placeholder" data-selected-file>
          ${escapeHtml(selectedName)}
        </div>
      </div>
      <div class="teacher-content-upload-row">
        <label class="teacher-content-name-field" for="teacherContentKnowledgeName">
          <span>Knowledge Pack Name</span>
          <input
            id="teacherContentKnowledgeName"
            type="text"
            value="${escapeAttr(contentName)}"
            placeholder="Name this knowledge content"
            data-upload-content-name
            ${uploadBusy || state.selectedUploadFiles.length > 1 ? 'disabled' : ''}
          >
        </label>
        <label class="teacher-content-name-field" for="teacherContentImportProfile">
          <span>Import profile</span>
          <select id="teacherContentImportProfile" class="${state.uploadImportProfileNeedsAttention ? 'teacher-content-required-glow' : ''}" ${uploadBusy ? 'disabled' : ''}>
            <option value="" ${state.uploadImportProfile ? '' : 'selected'} disabled>Choose import profile...</option>
            ${renderImportProfileOptions()}
          </select>
        </label>
        <button
          type="button"
          class="small-button"
          data-upload-create-review
        ${canAttemptCreateReview ? '' : 'disabled'}
      >${uploadBusy ? 'Analyzing upload...' : 'Analyze Upload'}</button>
        ${state.uploadQueueRunning ? '<button type="button" class="small-button secondary-small" data-upload-cancel-remaining>Cancel remaining</button>' : ''}
      </div>
      ${state.uploadImportProfileError ? `<p class="teacher-content-upload-note teacher-content-validation-note" data-upload-import-profile-validation>${escapeHtml(state.uploadImportProfileError)}</p>` : ''}
      ${state.selectedUploadFiles.length > 1 ? '<p class="teacher-content-upload-note">Pack names default from folder and file names when available.</p>' : ''}
      ${state.uploadFolderPathDebugNote ? `<p class="teacher-content-upload-note">${escapeHtml(state.uploadFolderPathDebugNote)}</p>` : ''}
      ${renderUploadQueueList()}
      ${renderUploadCreateProgress()}
      ${renderUploadProgressErrorPanel()}
      ${hasTechnicalDetails ? `<details class="teacher-content-upload-details" data-upload-technical-details>
        <summary>Technical details</summary>
        ${extractionSucceeded ? renderUploadExtractionSummary(result, extraction) : ''}
        ${state.uploadImportEstimate ? renderImportEstimatePanel() : ''}
        ${state.uploadAutoImportPlan ? renderAutoImportPlanPanel() : ''}
        ${state.uploadCreateReviewTimeline.length ? renderImportActivityPanel() : ''}
        ${state.uploadPrepareReviewLastFailure ? renderPrepareReviewFailurePanel(state.uploadPrepareReviewFailedMode || 'selected') : ''}
        ${renderAdvancedUploadDetails(result, extraction, false)}
      </details>` : ''}
    `;
  }

  function formatSelectedUploadLabel() {
    if (!state.selectedUploadFiles.length) {
      return state.selectedUploadFile?.name || state.uploadExtractionResult?.originalFileName || 'No file selected';
    }
    if (state.selectedUploadFiles.length === 1) return state.selectedUploadFiles[0].name;
    return `${state.selectedUploadFiles.length} files selected`;
  }

  function renderUploadQueueList() {
    const queue = Array.isArray(state.uploadQueue) ? state.uploadQueue : [];
    if (!queue.length) return '';
    const visibleRows = Math.min(queue.length, 6);
    const hasMoreRows = queue.length > visibleRows;
    return `
      <section class="teacher-content-upload-queue" data-upload-queue>
        <h5>Import queue</h5>
        <p class="teacher-content-upload-note" data-upload-queue-visibility>
          Showing ${formatNumber(visibleRows)} of ${formatNumber(queue.length)} queued file${queue.length === 1 ? '' : 's'}${hasMoreRows ? '. Scroll to view the remaining files.' : '.'}
        </p>
        <div class="teacher-content-review-table-shell">
          <div class="teacher-content-review-table-head">
            <span>File</span>
            <span>Proposed Pack Name</span>
            <span>Status</span>
          </div>
          <div class="teacher-content-review-table-body">
            ${queue.map((item) => `
              <div class="teacher-content-review-table-row" data-upload-queue-item data-upload-queue-status="${escapeAttr(item.status || 'waiting')}">
                <span data-upload-queue-file>${escapeHtml(item.fileName || 'Unknown file')}</span>
                <span data-upload-queue-pack-name>${escapeHtml(item.proposedPackName || '')}</span>
                <span data-upload-queue-status-label>${escapeHtml(renderUploadQueueStatusLabel(item))}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderUploadQueueStatusLabel(item) {
    const status = String(item?.status || 'waiting').trim().toLowerCase();
    if (status === 'draft_ready') return 'draft ready';
    if (status === 'failed') return 'failed';
    if (status === 'extracting') return 'extracting';
    if (status === 'processing') return 'processing';
    if (status === 'canceled') return 'canceled';
    return 'waiting';
  }

  function renderUploadStartPlanShell(uploadBusy) {
    const result = state.uploadExtractionResult || {};
    const estimate = state.uploadImportEstimate || null;
    const largeFullImport = Boolean(estimate?.isLarge);
    const fullImportConfirmed = !largeFullImport || state.fullImportConfirmText === 'CONFIRM';
    const canRunRecommended = Boolean(result.uploadId && estimate) && !uploadBusy;
    const canRunPreview = Boolean(result.uploadId && estimate) && !uploadBusy;
    const canRunSelectedImport = Boolean(result.uploadId && estimate) && !uploadBusy;
    const canRunFullImport = Boolean(result.uploadId && estimate) && !uploadBusy && fullImportConfirmed;
    return `
      <section class="teacher-content-start-plan" data-upload-start-page data-upload-start-planner>
        ${state.uploadImportEstimate ? renderImportEstimatePanel() : ''}
        ${state.uploadAutoImportPlan ? renderAutoImportPlanPanel() : ''}
        ${state.uploadAutoImportPlan ? renderRecommendedImportAction(canRunRecommended) : ''}
      </section>
      <details class="teacher-content-upload-details" data-upload-manual-recovery-controls data-import-override-controls>
        <summary>Manual recovery controls</summary>
        <p class="teacher-content-upload-note">Manual preview, selected range, and full-document overrides are secondary controls.</p>
        ${renderPreviewSizeControls(canRunPreview)}
        <div class="teacher-content-import-actions">
          <button type="button" class="small-button secondary-small" data-upload-run-preview ${canRunPreview ? '' : 'disabled'}>${state.uploadPrepareReviewLoading && !state.uploadPreviewComplete ? 'Running Preview Draft...' : 'Run Preview Draft'}</button>
          <button type="button" class="small-button secondary-small" data-upload-run-full-import ${canRunFullImport ? '' : 'disabled'}>${state.uploadPrepareReviewLoading ? 'Running Full Document Import...' : 'Run Full Document Import'}</button>
        </div>
        ${state.uploadPreviewReport ? renderPreviewReportPanel() : '<p class="profile-empty-state">No manual preview yet.</p>'}
        ${state.uploadPreviewReport ? `<div class="teacher-content-import-actions"><button type="button" class="small-button secondary-small" data-upload-run-selected-import data-selected-import-preset="preview">Rerun preview range as strict draft</button>${state.uploadPreviewPartial ? '<button type="button" class="small-button secondary-small" data-upload-retry-preview>Retry failed chunks with smaller limit</button>' : ''}</div>` : ''}
        <p class="profile-empty-state" data-selected-import-recommendation>For large packets, selected range import remains available when you intentionally want only part of the document.</p>
        ${renderSelectedImportControls(canRunSelectedImport)}
        ${renderWholeImportAdvanced(Boolean(result.uploadId && estimate) && !uploadBusy && fullImportConfirmed, largeFullImport)}
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
        <span class="teacher-content-pill ${stepStatus('previewImport') === 'FAILED' ? 'blocked' : state.uploadPreviewPartial ? 'review' : state.uploadImportEstimate ? 'ready' : state.uploadPrepareReviewLoading ? 'review' : 'muted'}">${escapeHtml(stepStatus('previewImport'))}</span>
      </div>
      ${state.uploadImportEstimate ? renderImportEstimatePanel() : '<p class="profile-empty-state">Waiting for an import estimate. Upload a source and create a review draft first.</p>'}
      ${state.uploadAutoImportPlan ? renderAutoImportPlanPanel() : ''}
      ${renderPrepareReviewFailurePanel('preview')}
      <p class="teacher-content-upload-note">${escapeHtml(getPreviewImportNote())}</p>
      ${state.uploadAutoImportPlan ? renderRecommendedImportAction(canRunPreview) : ''}
      ${state.uploadImportEstimate ? `<details class="teacher-content-upload-details" data-import-override-controls><summary>Advanced import overrides</summary>${renderPreviewSizeControls(canRunPreview)}</details>` : ''}
      <div class="teacher-content-import-actions">
        <button type="button" class="small-button" data-upload-run-preview ${canRunPreview ? '' : 'disabled'}>${state.uploadPrepareReviewLoading && !state.uploadPreviewComplete ? 'Running Preview Draft...' : 'Run Preview Draft'}</button>
        <button type="button" class="small-button secondary-small" data-upload-run-full-import ${canRunFullImport ? '' : 'disabled'}>Run Full Document Import</button>
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
        <span class="teacher-content-pill ${state.uploadPreviewPartial ? 'review' : state.uploadPrepareReviewFailedMode === 'preview' ? 'blocked' : state.uploadPreviewComplete ? 'ready' : state.uploadCreateReviewError ? 'blocked' : 'muted'}">${escapeHtml(stepStatus('reviewPreview'))}</span>
      </div>
      ${renderPrepareReviewFailurePanel('preview')}
      ${state.uploadPreviewReport ? renderPreviewReportPanel() : '<p class="profile-empty-state">No preview yet. Run Preview Draft first.</p>'}
      ${state.uploadPreviewReport ? '<p class="teacher-content-upload-note">This is temporary/sample output. Run Full Document Import before approving this as your main pack.</p>' : ''}
      ${state.uploadPreviewReport ? `<div class="teacher-content-import-actions"><button type="button" class="small-button" data-upload-run-selected-import data-selected-import-preset="preview">Rerun preview range as strict draft</button>${state.uploadPreviewPartial ? '<button type="button" class="small-button secondary-small" data-upload-retry-preview>Retry failed chunks with smaller limit</button>' : ''}</div>` : ''}
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
          <p>Run a full-document import after preview, or intentionally import a selected range.</p>
        </div>
        <span class="teacher-content-pill ${state.uploadPrepareReviewHandoff?.packId ? 'ready' : state.uploadPrepareReviewLoading ? 'review' : canRunFullImport ? 'ready' : 'muted'}">${escapeHtml(stepStatus('fullImport'))}</span>
      </div>
      ${renderPrepareReviewFailurePanel('full')}
      ${state.uploadPreviewComplete ? renderImportEstimatePanel() : `<p class="profile-empty-state">${state.uploadPreviewPartial ? 'Full Import is disabled until the partial preview is reviewed or the failed chunks are retried successfully.' : 'Analyze the upload first, or run a preview override from technical recovery controls.'}</p>`}
      ${state.uploadPreviewComplete ? '<p class="profile-empty-state" data-full-import-default-note>Full Document Import defaults to all text-bearing pages from the upload, not the preview page.</p>' : ''}
      ${state.uploadPreviewComplete ? `<div class="teacher-content-import-actions"><button type="button" class="small-button" data-upload-run-full-import ${canRunFullImport && fullImportConfirmed ? '' : 'disabled'}>${state.uploadPrepareReviewLoading ? 'Running Full Document Import...' : 'Run Full Document Import'}</button></div>` : ''}
      ${state.uploadPreviewComplete ? '<p class="profile-empty-state" data-selected-import-recommendation>For large packets, selected range import remains available when you intentionally want only part of the document.</p>' : ''}
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
    if (!state.selectedDraftPackId) {
      return cardWithEmptyState('Review Knowledge Packet', 'No draft pack is selected yet. Choose a draft pack before reviewing items.');
    }

    if (state.reviewActionLoading) {
      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Review Knowledge Packet</h4>
            <p>Saving draft-only review change...</p>
          </div>
          <span class="teacher-content-pill review">Saving</span>
        </div>
        <p class="profile-empty-state">Refreshing the selected review list.</p>
      `;
    }

    const groups = getReviewItemGroups();
    const allItems = getVisibleReviewItems();
    const filteredItems = getFilteredReviewItems(allItems);
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    const summary = getReviewProgressSummary(draft);
    const sectionCount = getReviewSectionCount(groups, draft);
    const totalReviewableCount = getTotalPrimaryDraftItemCount(draft);
    const needsReviewCount = allItems.length;
    const bulkReviewSummary = renderBulkReviewSummary();
    return `
      <div class="teacher-content-card-head">
        <div>
          <h4>Review Knowledge Packet</h4>
          <p data-review-summary-line>${escapeHtml(renderReviewSummaryLine(sectionCount, totalReviewableCount, needsReviewCount))}</p>
        </div>
        <span class="teacher-content-pill review">Draft Items</span>
      </div>
      ${renderReviewFilters()}
      ${bulkReviewSummary}
      ${renderReviewNeedsReviewSummary(draft)}
      ${state.reviewBulkMessage ? `<p class="teacher-content-review-bulk-message" data-review-bulk-message>${escapeHtml(state.reviewBulkMessage)}</p>` : ''}
      ${renderReviewActionBar(filteredItems)}
      ${renderReviewTable(filteredItems)}
      ${summary.pending === 0 && totalReviewableCount > 0 ? '<p class="profile-empty-state">All items in this draft have already been reviewed.</p>' : ''}
      ${state.errors.length ? renderIssueList('Review Messages', state.errors) : ''}
      ${renderReviewAdvancedDetails(draft)}
      ${state.selectedReviewEvidenceItem ? renderReviewEvidencePanel(state.selectedReviewEvidenceItem) : ''}
      ${state.selectedReviewItem ? renderReviewDetailPanel(state.selectedReviewItem) : ''}
    `;
  }

  function renderReviewDoneCard() {
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    const donePackName = draft?.title || draft?.packId || state.selectedDraftPackId || '';
    return `
      <section class="teacher-content-review-done" data-review-done-page>
        <div class="teacher-content-card-head">
          <div>
            <h4>Done</h4>
            <p>Import review is complete for this draft session.</p>
          </div>
          <span class="teacher-content-pill ready">Complete</span>
        </div>
        <p>Knowledge pack saved: <strong data-review-done-pack-name>${escapeHtml(donePackName || 'Current review draft')}</strong></p>
        <div class="teacher-content-done-actions">
          <button type="button" class="small-button secondary-small" data-review-done-view-knowledge-packs>Manage Knowledge Packs</button>
        </div>
      </section>
    `;
  }

  function renderReviewSummaryLine(sectionCount, itemCount, needsReviewCount) {
    if (Number(itemCount || 0) === 0) return 'No draft items were created from this upload.';
    return `${formatNumber(sectionCount)} sections checked • ${formatNumber(itemCount)} draft items found • ${formatNumber(needsReviewCount)} need review`;
  }

  function renderBulkReviewSummary() {
    const queuePacks = buildReviewQueuePacks();
    if (!queuePacks.length) return '';
    const currentIndex = Math.max(0, queuePacks.findIndex((pack) => pack.packId === state.selectedDraftPackId));
    const reviewPosition = `${currentIndex + 1} of ${queuePacks.length}`;
    return `
      <section class="teacher-content-review-bulk-summary" data-review-bulk-summary>
        <p data-review-bulk-summary-line>Reviewing ${escapeHtml(reviewPosition)} draft packs. Use the pack list to switch packs.</p>
        <p class="teacher-content-review-bulk-summary-label">Review queue:</p>
        <ul class="teacher-content-review-bulk-summary-list" data-review-bulk-summary-list>
          ${queuePacks.map((pack) => `
            <li>
              <button
                type="button"
                class="teacher-content-review-pack-card ${pack.packId === state.selectedDraftPackId ? 'active' : ''}"
                data-review-pack-select
                data-review-pack-id="${escapeAttr(pack.packId || '')}"
                ${pack.packId ? '' : 'disabled'}
              >
                <strong>${escapeHtml(pack.title)}</strong>
                <span>${escapeHtml(pack.statusLabel)}</span>
                ${pack.itemCountLabel ? `<small>${escapeHtml(pack.itemCountLabel)}</small>` : ''}
              </button>
            </li>
          `).join('')}
        </ul>
      </section>
    `;
  }

  function buildReviewQueuePacks() {
    const uploadQueue = Array.isArray(state.uploadQueue) ? state.uploadQueue : [];
    const draftLookup = new Map((Array.isArray(state.drafts) ? state.drafts : []).map((draft) => [String(draft.packId || ''), draft]));
    const queueCards = uploadQueue.map((item) => {
      const status = String(item?.status || 'waiting').toLowerCase();
      const packId = String(item?.packId || '').trim();
      const draft = packId ? draftLookup.get(packId) || null : null;
      const title = String(item?.proposedPackName || draft?.title || item?.fileName || 'Draft pack').trim();
      const summary = summarizeDraftReviewCounts(draft || {});
      const itemCount = getDraftItemCount(draft || {});
      const reviewed = summary.approved + summary.rejected;
      let statusLabel = 'needs review';
      if (status === 'failed') statusLabel = 'failed';
      else if (!packId || status === 'waiting' || status === 'extracting' || status === 'processing') statusLabel = 'needs review';
      else if (itemCount === 0) statusLabel = 'empty';
      else if (summary.pending > 0 && reviewed > 0) statusLabel = 'partially reviewed';
      else if (summary.pending === 0 && reviewed > 0) statusLabel = 'accepted';
      return {
        packId,
        title,
        statusLabel,
        itemCountLabel: `${formatNumber(itemCount)} items`
      };
    });
    if (queueCards.length) return queueCards;
    return (Array.isArray(state.drafts) ? state.drafts : []).map((draft) => {
      const summary = summarizeDraftReviewCounts(draft || {});
      const itemCount = getDraftItemCount(draft || {});
      const reviewed = summary.approved + summary.rejected;
      let statusLabel = 'needs review';
      if (itemCount === 0) statusLabel = 'empty';
      else if (summary.pending > 0 && reviewed > 0) statusLabel = 'partially reviewed';
      else if (summary.pending === 0 && reviewed > 0) statusLabel = 'accepted';
      return {
        packId: String(draft?.packId || ''),
        title: draft?.title || draft?.packId || 'Draft pack',
        statusLabel,
        itemCountLabel: `${formatNumber(itemCount)} items`
      };
    });
  }

  function summarizeDraftReviewCounts(draft = {}) {
    const counts = draft?.reviewCounts || {};
    return {
      pending: Number(counts.pending || draft?.totalPending || 0),
      approved: Number(counts.approved || 0),
      rejected: Number(counts.rejected || draft?.totalRejected || 0)
    };
  }

  function getDraftItemCount(draft = {}) {
    const counts = draft?.itemCounts || {};
    const fromItemCounts = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
    if (fromItemCounts > 0) return fromItemCounts;
    const reviewCounts = draft?.reviewCounts || {};
    const fromReviewCounts = Number(reviewCounts.pending || 0) + Number(reviewCounts.approved || 0) + Number(reviewCounts.rejected || 0);
    if (fromReviewCounts > 0) return fromReviewCounts;
    return Number(draft?.totalPending || 0) + Number(draft?.totalRejected || 0);
  }

  function renderReviewFilters() {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'vocabulary', label: 'Vocabulary' },
      { id: 'concepts', label: 'Concepts' },
      { id: 'referenceFormulas', label: 'Reference Formulas' },
      { id: 'needsReview', label: 'Needs Review' }
    ];
    return `
      <nav class="teacher-content-review-filters" data-review-filter-tabs>
        ${filters.map((filter) => `
          <button
            type="button"
            class="teacher-content-review-filter ${state.reviewListFilter === filter.id ? 'active' : ''}"
            data-review-filter="${escapeAttr(filter.id)}"
          >${escapeHtml(filter.label)}</button>
        `).join('')}
      </nav>
    `;
  }

  function renderReviewNeedsReviewSummary(draft = {}) {
    const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
    const failedSections = buildTeacherFriendlyFailedSections(coverage);
    const failedChunks = countFailedAfterRetrySections(coverage);
    if (!failedSections.length && failedChunks === 0) return '';
    const summaryCount = failedSections.length || failedChunks;
    return `
      <section class="teacher-content-review-needs-review" data-review-needs-review-summary>
        <p>${formatNumber(summaryCount)} section${summaryCount === 1 ? '' : 's'} could not be processed. You can still review and accept the items that were created.</p>
        <button type="button" class="small-button secondary-small" data-review-needs-review-toggle>${state.reviewNeedsReviewExpanded ? 'Hide sections needing review' : 'Show sections needing review'}</button>
        ${state.reviewNeedsReviewExpanded ? `
          <ul data-review-needs-review-list>
            ${failedSections.map((section) => `<li>${escapeHtml(section.sourceLocation)}: ${escapeHtml(section.reason)}</li>`).join('')}
          </ul>
        ` : ''}
      </section>
    `;
  }

  function renderReviewTable(items) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      if (state.reviewListFilter === 'all' && !hasAnyPrimaryDraftItems()) {
        return '<p class="profile-empty-state" data-review-empty-list>No draft items were created from this upload.</p>';
      }
      if (state.reviewListFilter === 'all' && hasAnyPrimaryDraftItems()) {
        return '<p class="profile-empty-state" data-review-empty-list>All items in this draft have already been reviewed.</p>';
      }
      return '<p class="profile-empty-state" data-review-empty-list>No review rows match this filter.</p>';
    }
    return `
      <section class="teacher-content-review-table-shell" data-review-draft-content-page>
        <div class="teacher-content-review-table-head">
          <span>Select</span>
          <span>Category</span>
          <span>Title / Term</span>
          <span>Student-friendly wording</span>
          <span>Type / Status</span>
          <span>Actions</span>
        </div>
        <div class="teacher-content-review-table-body">
          ${rows.map((item) => renderReviewTableRow(item)).join('')}
        </div>
      </section>
    `;
  }

  function renderReviewTableRow(item) {
    const itemKey = reviewItemKey(item.section, item.index);
    const selected = state.selectedReviewItemKeys.includes(itemKey);
    const safe = isReviewItemSafeToAccept(item);
    const wording = getDraftItemWording(item);
    const typeStatus = formatReviewTypeStatus(item);
    return `
      <div class="teacher-content-review-table-row ${selected ? 'selected' : ''} ${safe ? '' : 'unsafe'}" data-review-table-row data-review-item-card data-review-item-key="${escapeAttr(itemKey)}" data-review-item-safe="${safe ? 'true' : 'false'}">
        <label class="teacher-content-review-select-control" data-review-select-control>
          <input
            type="checkbox"
            ${selected ? 'checked' : ''}
            data-review-selection-checkbox
            data-review-selection-item-key="${escapeAttr(itemKey)}"
            data-section="${escapeAttr(item.section)}"
            data-index="${escapeAttr(item.index)}"
            aria-label="Select draft item for Accept Selected"
          >
          <span>Select</span>
        </label>
        <span data-review-item-category>${escapeHtml(SECTION_LABELS[item.section] || item.section || 'Not set')}</span>
        <strong data-review-item-label>${escapeHtml(item.label || item.term || item.id || 'Draft item')}</strong>
        <div class="teacher-content-review-wording">
          <p data-review-item-wording>${escapeHtml(wording)}</p>
          <details class="teacher-content-review-source-details" data-review-source-details>
            <summary>Show source</summary>
            <p data-review-item-source-file>File: ${escapeHtml(item.sourceFile || 'No source file')}</p>
            <p data-review-item-source-location>Location: ${escapeHtml(item.sourceLocation || 'No source location')}</p>
            <p data-review-item-snippet>Snippet: ${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
          </details>
        </div>
        <span data-review-item-type-status>${escapeHtml(typeStatus)}</span>
        <div class="teacher-content-review-row-actions">
          <button type="button" class="small-button secondary-small" data-review-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Edit</button>
        </div>
      </div>
    `;
  }

  function renderReviewAdvancedDetails(draft = {}) {
    const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
    const sourceManifest = Array.isArray(coverage.sourceManifest) ? coverage.sourceManifest : [];
    const coverageSummary = coverage.coverageSummary || state.report?.coverageReport?.coverageSummary || {};
    const technicalWarnings = [
      ...(Array.isArray(state.report?.warnings) ? state.report.warnings : []),
      ...(Array.isArray(state.report?.technicalErrors) ? state.report.technicalErrors : []),
      ...(Array.isArray(state.report?.errors) ? state.report.errors : [])
    ].filter((warning) => !isPausedStandardsWarning(warning));
    return `
      <details class="teacher-content-review-advanced-details" data-review-advanced-details>
        <summary>Advanced details</summary>
        ${technicalWarnings.length ? renderIssueList('Technical warnings', technicalWarnings) : ''}
        ${renderCoverageReport(state.report?.coverageReport)}
        ${Object.keys(coverageSummary).length ? `<pre data-review-coverage-summary>${escapeHtml(JSON.stringify(coverageSummary, null, 2))}</pre>` : ''}
        ${sourceManifest.length ? `<pre data-review-source-manifest>${escapeHtml(JSON.stringify(sourceManifest, null, 2))}</pre>` : '<p>No source manifest entries.</p>'}
      </details>
    `;
  }

  function isPausedStandardsWarning(value) {
    const text = String(value || '');
    return PAUSED_STANDARDS_WARNING_PATTERNS.some((pattern) => pattern.test(text));
  }

  function getFilteredReviewItems(items) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => isReviewFilterMatch(item, state.reviewListFilter));
  }

  function isReviewFilterMatch(item, filterId) {
    if (!filterId || filterId === 'all') return true;
    if (filterId === 'needsReview') {
      return isItemNeedingTeacherReview(item);
    }
    return item.section === filterId;
  }

  function setReviewListFilter(filterId) {
    const nextFilter = ['all', 'vocabulary', 'concepts', 'referenceFormulas', 'needsReview'].includes(filterId) ? filterId : 'all';
    state.reviewListFilter = nextFilter;
    state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => {
      const item = findPendingItemByKey(key);
      return item && isReviewFilterMatch(item, nextFilter);
    });
    render();
  }

  function toggleSelectAllVisibleReviewItems() {
    const visible = getFilteredReviewItems(getVisibleReviewItems());
    const keys = visible.map((item) => reviewItemKey(item.section, item.index));
    const allSelected = keys.length > 0 && keys.every((key) => state.selectedReviewItemKeys.includes(key));
    const selected = new Set(state.selectedReviewItemKeys);
    keys.forEach((key) => {
      if (allSelected) selected.delete(key);
      else selected.add(key);
    });
    state.selectedReviewItemKeys = Array.from(selected);
    state.reviewBulkMessage = '';
    render();
  }

  function formatReviewTypeStatus(item) {
    const type = item.section === 'referenceFormulas' ? 'reference' : item.section || 'item';
    const status = item.reviewStatus || 'pending';
    return `${type} • ${status}`;
  }

  function countSectionsNeedingReview(draft = {}) {
    const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
    const failedBatches = Array.isArray(coverage.failedBatches) ? coverage.failedBatches.filter(Boolean) : [];
    const failedChunks = countFailedAfterRetrySections(coverage);
    if (failedChunks > 0) return failedChunks;
    if (!failedBatches.length) return 0;
    return failedBatches.length;
  }

  function countFailedAfterRetrySections(coverage = {}) {
    const summaryCount = Number(coverage?.coverageSummary?.failedChunks || 0);
    if (Number.isFinite(summaryCount) && summaryCount > 0) return summaryCount;
    const sourceManifest = Array.isArray(coverage?.sourceManifest) ? coverage.sourceManifest : [];
    const manifestFailed = sourceManifest.filter((entry) => String(entry?.status || '').toLowerCase() === 'failed_after_retries').length;
    if (manifestFailed > 0) return manifestFailed;
    return 0;
  }

  function buildTeacherFriendlyFailedSections(coverage = {}) {
    const failedBatches = Array.isArray(coverage.failedBatches) ? coverage.failedBatches.filter(Boolean) : [];
    const sourceManifest = Array.isArray(coverage.sourceManifest) ? coverage.sourceManifest : [];
    const manifestFailures = sourceManifest
      .filter((entry) => String(entry?.status || '').toLowerCase() === 'failed_after_retries')
      .map((entry) => {
        const matchedBatch = findMatchingFailedBatchForManifestEntry(entry, failedBatches);
        return {
          sourceLocation: formatTeacherFailedSectionLocation(entry?.sourceLocation),
          reason: summarizeTeacherFailedSectionReason(matchedBatch && matchedBatch.errors)
        };
      })
      .filter((entry) => Boolean(entry.sourceLocation));
    if (manifestFailures.length) return manifestFailures;

    const fallback = [];
    failedBatches.forEach((batch) => {
      const locations = [];
      if (Array.isArray(batch.pages) && batch.pages.length) {
        batch.pages.forEach((page) => locations.push(`Page ${page}`));
      }
      if (Array.isArray(batch.chunkLabels) && batch.chunkLabels.length) {
        batch.chunkLabels.forEach((label) => locations.push(formatTeacherFailedSectionLocation(label)));
      }
      if (!locations.length) locations.push('Source section');
      const reason = summarizeTeacherFailedSectionReason(batch.errors);
      locations.forEach((sourceLocation) => fallback.push({ sourceLocation, reason }));
    });

    const seen = new Set();
    return fallback.filter((entry) => {
      const key = `${entry.sourceLocation}|${entry.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function findMatchingFailedBatchForManifestEntry(entry, failedBatches) {
    const manifestLocation = normalizeSimpleText(entry?.sourceLocation);
    const match = String(entry?.sourceLocation || '').match(/\b(?:page|slide)\s*(\d+)\b/i);
    const manifestPage = match ? Number(match[1]) : 0;
    return (Array.isArray(failedBatches) ? failedBatches : []).find((batch) => {
      const pages = Array.isArray(batch?.pages) ? batch.pages.map(Number) : [];
      if (manifestPage > 0 && pages.includes(manifestPage)) return true;
      const chunkLabels = Array.isArray(batch?.chunkLabels) ? batch.chunkLabels : [];
      return chunkLabels.some((label) => {
        const normalizedLabel = normalizeSimpleText(label);
        return normalizedLabel && manifestLocation
          && (normalizedLabel.includes(manifestLocation) || manifestLocation.includes(normalizedLabel));
      });
    }) || null;
  }

  function formatTeacherFailedSectionLocation(value) {
    const text = String(value || '').trim();
    return text || 'Source section';
  }

  function summarizeTeacherFailedSectionReason(errors) {
    const text = (Array.isArray(errors) ? errors : []).map((entry) => String(entry || '')).join(' ').toLowerCase();
    if (!text) return 'The local model returned incomplete output.';
    if (text.includes('not valid json')
      || text.includes('complete json object')
      || text.includes('json repair retry also failed')
      || text.includes('unterminated')
      || text.includes('unexpected end')) {
      return 'The local model returned incomplete output.';
    }
    if (text.includes('timed out') || text.includes('timeout')) {
      return 'The local model took too long to return output.';
    }
    if (text.includes('model runner has unexpectedly stopped')
      || text.includes('resource limitations')
      || text.includes('crash')) {
      return 'The local model stopped while processing this section.';
    }
    return 'The local model could not process this section.';
  }

  function normalizeSimpleText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function renderReviewCompletionPanel(canCreateApprovedPack, promoteLabel) {
    return `
      <section class="teacher-content-review-empty" data-review-empty-state>
        <h5>No pending review items.</h5>
        <p>${canCreateApprovedPack ? 'This draft is ready to create an approved pack from approved items only.' : 'This draft has no approved items to promote yet.'}</p>
        <div class="teacher-content-review-empty-actions">
          ${canCreateApprovedPack ? `
            <button type="button" class="small-button" data-promote-draft data-review-create-approved-pack ${state.promotionActionLoading ? 'disabled' : ''}>${escapeHtml(promoteLabel)}</button>
          ` : ''}
          <button type="button" class="small-button secondary-small" data-handoff-tab="upload">Back to Upload / Start</button>
          <button type="button" class="small-button secondary-small" data-review-done-view-knowledge-packs>Manage Knowledge Packs</button>
        </div>
      </section>
    `;
  }

  function renderReviewPlannerNotes() {
    const notes = state.report?.draftPack?.plannerNotes || {};
    const rawWarnings = Array.isArray(notes.warnings) ? notes.warnings : [];
    const teacherNotes = Array.isArray(notes.teacherNotes) && notes.teacherNotes.length
      ? notes.teacherNotes
      : makeTeacherPlannerNotes(rawWarnings, notes);
    if (!teacherNotes.length && !rawWarnings.length) return '';
    return `
      <section class="teacher-content-review-note" data-review-planner-notes>
        ${teacherNotes.length ? teacherNotes.map((note) => `<p>${escapeHtml(note)}</p>`).join('') : '<p>Some upload details may need teacher review before approval.</p>'}
        ${rawWarnings.length ? `
          <details class="teacher-content-backend-details" data-review-planner-technical-details>
            <summary>Technical details</summary>
            <ul>${rawWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
          </details>
        ` : ''}
      </section>
    `;
  }

  function makeTeacherPlannerNotes(warnings, plan = {}) {
    const text = (Array.isArray(warnings) ? warnings : []).join(' ').toLowerCase();
    const notes = [];
    if (/ocr|vision|image|little or no extracted text|no text-bearing/.test(text)) {
      notes.push('Some pages had little extracted text. Image-only content may need OCR later.');
    }
    if (/available memory is low|low memory/.test(text)) {
      notes.push('This draft used a smaller safe range because local memory looked limited.');
    }
    if (plan.mode === 'manual_review_needed') {
      notes.push('This upload needs manual review before a draft can be generated.');
    }
    return notes;
  }

  function renderSourceGroundingReviewNotice() {
    const items = getVisibleReviewItems();
    const unsupported = items.filter((item) => {
      return item.sourceGrounding && item.sourceGrounding.status && item.sourceGrounding.status !== 'supported';
    });
    const reportWarnings = Array.isArray(state.report?.warnings) ? state.report.warnings : [];
    const sourceWarnings = reportWarnings.filter((warning) => /source[- ]?ground|source evidence|supported by the extracted source/i.test(String(warning || '')));
    if (!unsupported.length && !sourceWarnings.length) return '';
    return `
      <section class="teacher-content-review-note warning" data-review-source-grounding-warnings>
        <p>Some generated items need stronger source evidence before they can be accepted.</p>
        <span>${formatNumber(unsupported.length)} item${unsupported.length === 1 ? '' : 's'} blocked by source-grounding checks.</span>
        ${sourceWarnings.length ? `
          <details class="teacher-content-backend-details" data-review-source-grounding-technical-details>
            <summary>Technical details</summary>
            <ul>${sourceWarnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
          </details>
        ` : ''}
      </section>
    `;
  }

  function renderFailedBatchReviewNotice(draft = {}) {
    const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
    const failedBatches = Array.isArray(coverage.failedBatches) ? coverage.failedBatches.filter(Boolean) : [];
    if (!failedBatches.length) return '';
    return `
      <section class="teacher-content-review-note warning" data-review-failed-slides-notice>
        <p>Some slides could not be analyzed. Review the extracted items below, then retry the failed slides later if needed.</p>
        <span>${escapeHtml(formatFailedBatchPageNotice(failedBatches))}</span>
        ${renderFailedBatchSummary(failedBatches)}
      </section>
    `;
  }

  function renderReviewItemCard(item) {
    const confidence = formatConfidence(item.confidence);
    const wording = getDraftItemWording(item);
    const itemStatus = getDraftItemSafetyStatus(item);
    const itemKey = reviewItemKey(item.section, item.index);
    const selected = state.selectedReviewItemKeys.includes(itemKey);
    const safe = isReviewItemSafeToAccept(item);
    const editableFields = EDITABLE_FIELDS[item.section] || [];
    return `
      <div class="teacher-content-review-item ${selected ? 'selected' : ''} ${safe ? '' : 'unsafe'}" data-review-item-card data-review-item-key="${escapeAttr(itemKey)}" data-review-item-safe="${safe ? 'true' : 'false'}">
        <label class="teacher-content-review-select-control" data-review-select-control>
          <input
            type="checkbox"
            ${selected ? 'checked' : ''}
            data-review-selection-checkbox
            data-review-selection-item-key="${escapeAttr(itemKey)}"
            data-section="${escapeAttr(item.section)}"
            data-index="${escapeAttr(item.index)}"
            aria-label="Select draft item for Accept Selected"
          >
          <span>Select draft item</span>
        </label>
        <div class="teacher-content-review-item-main">
          <strong data-review-item-label>${escapeHtml(item.label || 'Draft item')}</strong>
          <span data-review-item-category>Category: ${escapeHtml(SECTION_LABELS[item.section] || item.section || 'Not set')}</span>
          <span data-review-item-status>Validation/review status: ${escapeHtml(item.reviewStatus || 'pending')}</span>
          <span data-review-item-standards>Standards: ${escapeHtml(formatStandardsAlignmentStatus(item))}</span>
          <span data-review-item-warning-status>Warning/repair/quarantine status: ${escapeHtml(itemStatus)}</span>
          <span data-review-item-source-grounding>Source grounding: ${escapeHtml(formatSourceGroundingStatus(item))}</span>
          <span data-review-item-source-file>Source file: ${escapeHtml(item.sourceFile || 'No source file')}</span>
          <span data-review-item-source-location>Source location: ${escapeHtml(item.sourceLocation || 'No source location')}</span>
          <p data-review-item-wording>${escapeHtml(wording)}</p>
          <p data-review-item-snippet>Source snippet: ${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
        </div>
        <div class="teacher-content-review-item-evidence">
          <span class="teacher-content-confidence ${escapeAttr(confidence.className)}" data-review-item-confidence>${escapeHtml(confidence.label)}</span>
          <button type="button" class="small-button secondary-small" data-review-item-evidence data-review-evidence data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">View Evidence</button>
        </div>
        <div class="teacher-content-review-actions">
          ${editableFields.length ? `<button type="button" class="small-button secondary-small" data-review-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">Edit</button>` : ''}
          ${editableFields.length ? `<button type="button" class="small-button secondary-small" data-review-edit data-review-view-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}">View/Edit</button>` : ''}
          <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}" ${item.reviewStatus === 'approved' ? 'disabled' : ''}>Approve</button>
          <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}" ${item.reviewStatus === 'rejected' ? 'disabled' : ''}>Reject</button>
        </div>
      </div>
    `;
  }

  function renderReviewActionBar(items) {
    const totalSelected = state.selectedReviewItemKeys.length;
    const visible = Array.isArray(items) ? items : [];
    const allRows = getVisibleReviewItems();
    const safeVisible = visible.filter(isReviewItemSafeToAccept).length;
    const safeSelected = visible.filter((item) => state.selectedReviewItemKeys.includes(reviewItemKey(item.section, item.index)) && isReviewItemSafeToAccept(item)).length;
    const safeAll = allRows.filter(isReviewItemSafeToAccept).length;
    const skippedAll = Math.max(0, visible.length - safeVisible);
    const allVisibleSelected = visible.length > 0 && visible.every((item) => state.selectedReviewItemKeys.includes(reviewItemKey(item.section, item.index)));
    return `
      <section class="teacher-content-review-action-bar" data-review-bottom-action-bar>
        <div>
          <strong data-review-selected-count>${formatNumber(totalSelected)} selected</strong>
          <span data-review-valid-selected-count>${formatNumber(safeSelected)} valid selected</span>
          <span data-review-valid-all-count>${formatNumber(safeAll)} valid available</span>
          ${skippedAll ? `<small data-review-skipped-available-count>${formatNumber(skippedAll)} unreviewable item${skippedAll === 1 ? '' : 's'} will be skipped.</small>` : '<small data-review-approved-pack-note>Approved packs are saved for later and are not connected to student answers yet.</small>'}
        </div>
        <div class="teacher-content-review-action-buttons">
          <button type="button" class="small-button secondary-small" data-review-select-all>${allVisibleSelected ? 'Clear Select All' : 'Select All'}</button>
          <button type="button" class="small-button secondary-small" data-review-cancel>Cancel</button>
          <button type="button" class="small-button" data-review-accept-selected ${state.reviewActionLoading || totalSelected === 0 ? 'disabled' : ''}>Accept Selected</button>
          <button type="button" class="small-button" data-review-accept-all ${state.reviewActionLoading || safeAll === 0 ? 'disabled' : ''}>Accept All</button>
        </div>
      </section>
    `;
  }

  function getDraftItemWording(item) {
    const fields = item?.editableFields && typeof item.editableFields === 'object' ? item.editableFields : {};
    const orderedValues = [
      item?.draftWording,
      item?.studentDefinition,
      item?.studentExplanation,
      item?.expectedAnswer,
      item?.question,
      item?.equation,
      item?.standardId,
      fields.studentDefinition,
      fields.studentExplanation,
      fields.expectedAnswer,
      fields.equation,
      fields.standardId,
      fields.teacherDefinition,
      fields.misconception
    ];
    const value = orderedValues.find((entry) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return String(entry || '').trim();
    });
    if (Array.isArray(value)) return value.join(' ');
    return String(value || 'Draft wording not available in this report item.');
  }

  function formatStandardsAlignmentStatus(item) {
    const status = item?.standardsStatusLabel
      || item?.standards?.alignmentStatus
      || 'not_aligned_yet';
    return String(status).replace(/_/g, ' ');
  }

  function getDraftItemSafetyStatus(item) {
    const raw = [
      item?.validationStatus,
      item?.repairStatus,
      item?.quarantineStatus,
      item?.warningStatus
    ].filter(Boolean).join(' / ');
    return raw || (isPendingReviewStatus(item?.reviewStatus) ? 'Needs teacher review' : 'No warnings recorded');
  }

  function formatSourceGroundingStatus(item) {
    const grounding = item?.sourceGrounding && typeof item.sourceGrounding === 'object' ? item.sourceGrounding : null;
    if (!grounding) return item?.sourceTextSnippet ? 'Source snippet available' : 'No source evidence recorded';
    if (grounding.status === 'supported') return 'Supported by source evidence';
    return 'Needs stronger source evidence';
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
    const history = renderUploadedSourcesHistory();
    const selectedCount = state.selectedApprovedPackIds.length;
    if (!state.approved.length) {
      return `
        <section class="teacher-content-approved-empty" data-no-approved-packs-empty-state data-knowledge-packs-blade>
          <strong>No approved knowledge packs yet.</strong>
          <p>Review imported draft content before creating approved packs.</p>
          <button type="button" class="small-button secondary-small" data-approved-empty-tab="review">View Review Draft Content</button>
        </section>
        ${history}
      `;
    }

    return `
      <section class="teacher-content-approved-status" data-approved-pack-status-language>
        <span>Approved</span>
        <span>Saved for later. Not connected to student answers yet.</span>
      </section>
      <section class="teacher-content-approved-bulk-actions" data-approved-pack-bulk-delete-panel>
        <div>
          <strong>Selected for deletion: <span data-approved-pack-selected-count>${selectedCount}</span></strong>
          <p>Selection checkboxes only choose approved packs to archive. Activation checkboxes only save future router activation settings.</p>
        </div>
        <button
          type="button"
          class="small-button danger-small"
          ${selectedCount && !state.approvedBulkDeleteSaving ? '' : 'disabled'}
          data-approved-pack-bulk-delete-action
        >
          ${state.approvedBulkDeleteSaving ? 'Deleting selected...' : 'Delete selected knowledge packs'}
        </button>
      </section>
      <p class="teacher-content-approved-delete-message" data-approved-pack-bulk-delete-message>${escapeHtml(state.approvedBulkDeleteMessage)}</p>
      <div class="teacher-content-approved-list" data-knowledge-packs-blade>
        ${state.approved.map(renderApprovedPack).join('')}
      </div>
      ${renderApprovedSearchableSummary()}
      ${history}
    `;
  }

  function renderDraftPacksCard() {
    if (!state.drafts.length) {
      return `
        <section class="teacher-content-approved-empty" data-no-draft-packs-empty-state>
          <strong>No draft knowledge packs yet.</strong>
          <p>Upload content in Create New Knowledge to generate draft packs for review.</p>
        </section>
      `;
    }

    return `
      <section class="teacher-content-approved-status" data-draft-pack-status-language>
        <span>Draft Packs</span>
        <span>Drafts stay in teacher review until accepted and promoted.</span>
      </section>
      <div class="teacher-content-approved-list" data-draft-pack-list>
        ${state.drafts.map(renderDraftPack).join('')}
      </div>
    `;
  }

  function renderDraftPack(draft) {
    const packId = String(draft?.packId || '');
    const title = draft?.title || packId || 'Draft pack';
    return `
      <section class="teacher-content-simple-pack-row teacher-content-draft-pack" data-draft-pack-card data-knowledge-pack-row>
        <div class="teacher-content-simple-pack-title">
          <strong data-draft-pack-title>${escapeHtml(title)}</strong>
          <span class="teacher-content-pill muted" data-draft-pack-badge>Draft</span>
        </div>
        <div class="teacher-content-simple-pack-toggle">
          <label class="teacher-content-checkbox-control">
            <input type="checkbox" disabled>
            <span>Approve before enabling</span>
          </label>
        </div>
        <div class="teacher-content-simple-pack-actions">
          <button type="button" class="small-button secondary-small" data-draft-pack-view-edit-action data-draft-pack-id="${escapeAttr(packId)}">Edit</button>
          <button type="button" class="small-button danger-small" data-draft-pack-delete-action disabled title="Draft archive is not available in this view yet.">Delete</button>
        </div>
      </section>
    `;
  }

  function renderApprovedPack(pack) {
    const packId = pack.packId || '';
    const activationEnabled = pack.activationEnabled === true;
    const activationSaving = state.approvedActivationSaving[packId] === true;
    const deleteSaving = state.approvedDeleteSaving[packId] === true;
    const activationLabel = activationSaving
      ? 'Saving...'
      : (activationEnabled ? 'Enabled for student answers' : 'Disabled for student answers');
    return `
      <section class="teacher-content-simple-pack-row" data-approved-pack-card data-knowledge-pack-row>
        <div class="teacher-content-simple-pack-title">
          <strong data-approved-pack-title>${escapeHtml(pack.title || pack.packId || 'Approved pack')}</strong>
        </div>
        <div class="teacher-content-simple-pack-toggle">
          <label class="teacher-content-checkbox-control">
            <input
              type="checkbox"
              ${activationEnabled ? 'checked' : ''}
              ${activationSaving || !packId ? 'disabled' : ''}
              data-approved-pack-toggle-action
              data-approved-pack-id="${escapeAttr(packId)}"
              data-approved-pack-activation-checkbox
            >
            <span>${escapeHtml(activationEnabled ? 'Enabled for student answers' : 'Disabled for student answers')}</span>
          </label>
          <small data-approved-pack-activation-status>${escapeHtml(activationLabel)}</small>
        </div>
        <div class="teacher-content-simple-pack-actions">
          <button type="button" class="small-button secondary-small" data-approved-pack-view-edit-action data-approved-pack-id="${escapeAttr(packId)}">Edit</button>
          <button type="button" class="small-button danger-small" ${deleteSaving || !packId ? 'disabled' : ''} data-approved-pack-delete-action data-approved-pack-id="${escapeAttr(packId)}" data-approved-pack-title-confirm="${escapeAttr(pack.title || pack.packId || '')}">
            ${deleteSaving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </section>
    `;
  }

  function renderUploadedSourcesHistory() {
    const sources = Array.isArray(state.uploadedSources) ? state.uploadedSources : [];
    return `
      <section class="teacher-content-uploaded-sources" data-uploaded-sources-history data-upload-history-blade>
        <div class="teacher-content-card-head">
          <div>
            <h5>Uploaded Sources</h5>
            <p>Upload History for extracted source files. Source files, draft packs, and approved packs are preserved.</p>
          </div>
          <span class="teacher-content-pill ${sources.length ? 'ready' : 'muted'}">${sources.length ? 'Available' : 'Empty'}</span>
        </div>
        ${sources.length ? `
          <div class="teacher-content-approved-list">
            ${sources.map(renderUploadedSourceHistoryItem).join('')}
          </div>
        ` : '<p class="profile-empty-state" data-no-uploaded-sources-empty-state>No uploaded source history yet. Extraction records will appear here after files are uploaded.</p>'}
      </section>
    `;
  }

  function renderUploadedSourceHistoryItem(source) {
    const warnings = Array.isArray(source.warnings) ? source.warnings : [];
    const draftPacks = Array.isArray(source.draftPacks) ? source.draftPacks : [];
    const approvedPacks = Array.isArray(source.approvedPacks) ? source.approvedPacks : [];
    return `
      <section class="teacher-content-approved-pack" data-uploaded-source-card>
        <div class="teacher-content-approved-head">
          <div>
            <strong data-uploaded-source-original-filename>${escapeHtml(source.originalFileName || source.storedFileName || 'Uploaded source')}</strong>
            <span data-uploaded-source-upload-id>${escapeHtml(source.uploadId || 'No upload ID')}</span>
          </div>
          <div class="teacher-content-approved-badges">
            <span data-uploaded-source-draft-exists>${source.draftPackExists ? 'Draft pack exists' : 'No draft pack'}</span>
            <span data-uploaded-source-approved-exists>${source.approvedPackExists ? 'Approved pack exists' : 'No approved pack'}</span>
          </div>
        </div>
        <div class="teacher-content-approved-meta">
          ${metadataPill('File type', source.fileType || 'Unknown', 'data-uploaded-source-file-type')}
          ${metadataPill('Extracted pages/slides/sheets', formatNumber(source.extractedUnitCount), 'data-uploaded-source-extracted-count')}
          ${metadataPill('Text-bearing pages/slides', formatNumber(source.textBearingUnitCount), 'data-uploaded-source-text-bearing-count')}
          ${metadataPill('First text-bearing page/slide', source.firstTextBearingUnit ? formatNumber(source.firstTextBearingUnit) : 'None found', 'data-uploaded-source-first-text-bearing')}
          ${metadataPill('Updated', formatDate(source.updatedAt) || 'Not available', 'data-uploaded-source-updated-date')}
        </div>
        ${renderChipList('Draft pack from upload', draftPacks.map(formatPackMatch), 'data-uploaded-source-draft-packs')}
        ${renderChipList('Approved pack from upload', approvedPacks.map(formatPackMatch), 'data-uploaded-source-approved-packs')}
        ${renderChipList('Warnings', warnings, 'data-uploaded-source-warnings')}
      </section>
    `;
  }

  function formatPackMatch(pack) {
    if (!pack) return '';
    return pack.title && pack.packId ? `${pack.title} (${pack.packId})` : pack.packId || pack.title || '';
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
    if (back) back.disabled = index <= 0 || state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading;
    if (next) next.disabled = index >= TABS.length - 1 || state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading;
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

  function setUploadProgress(label, detail = '', percent = 0, tone = 'working') {
    const numeric = Number(percent);
    state.uploadProgress = {
      label: label || 'Ready',
      detail: detail || '',
      percent: Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 0)),
      tone
    };
  }

  function clearUploadProgressError() {
    state.uploadProgressError = null;
  }

  function setUploadProgressError(title, failedStep, error, suggestions = []) {
    const detail = makeUploadProgressTeacherMessage(error);
    const backendDetails = uniqueStrings([
      error?.status ? `HTTP status: ${error.status}` : error?.data?.status ? `HTTP status: ${error.data.status}` : '',
      ...(Array.isArray(error?.errors) ? error.errors : []),
      ...(Array.isArray(error?.data?.errors) ? error.data.errors : []),
      ...(Array.isArray(error?.data?.technicalErrors) ? error.data.technicalErrors : []),
      ...(Array.isArray(error?.data?.failedBatches) ? error.data.failedBatches.map(formatFailedBatchDetail) : []),
      error?.data?.model ? `Model: ${error.data.model}` : '',
      error?.data?.importEstimate?.previewMaxCharacters ? `Preview character limit: ${error.data.importEstimate.previewMaxCharacters}` : '',
      error?.data?.details,
      error?.data?.rawModelResponsePath ? `Raw model response: ${error.data.rawModelResponsePath}` : ''
    ].map(formatBackendDetail).filter((detailText) => detailText !== detail));
    state.uploadProgressError = {
      title: title || 'Import needs attention',
      failedStep: failedStep || 'Import',
      detail,
      failedBatchNotice: formatFailedBatchPageNotice(error?.data?.failedBatches || error?.failedBatches || []),
      backendDetails,
      suggestions: uniqueStrings(normalizeUploadProgressSuggestions(error, suggestions)).slice(0, 2)
    };
    setUploadProgress('Error', detail, 24, 'error');
  }

  function makeUploadProgressTeacherMessage(error) {
    const data = error?.data || {};
    if (isModelRuntimeTimeoutPayload(data) || isModelRuntimeTimeoutPayload(error)) {
      return 'Local Gemma took too long while reading this batch.';
    }
    if (isModelRuntimeCrashPayload(data) || isModelRuntimeCrashPayload(error)) {
      return 'Local Gemma crashed while reading this batch.';
    }
    return data.teacherFriendlyError || data.message || error?.message || error || 'Something went wrong.';
  }

  function normalizeUploadProgressSuggestions(error, suggestions = []) {
    if (isModelRuntimeTimeoutPayload(error?.data || error)) {
      return ['Try a smaller preview range or lower character limit.'];
    }
    if (isModelRuntimeCrashPayload(error?.data || error)) {
      return ['Try a smaller preview range, lower character limit, or a lighter local model.'];
    }
    return suggestions;
  }

  function setActiveTab(tabId) {
    if (!TABS.some((tab) => tab.id === tabId)) return;
    if (tabId === 'complete' && !state.reviewCompleted) {
      setStatus('Finish review and accept items before opening Done.');
      return;
    }
    if ((state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading) && tabId !== state.activeTab) {
      setStatus('Generation is still running. Stop it before leaving this step.');
      return;
    }
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
      if (state.uploadQueueRunning) return 'PROCESSING';
      const queueSummary = summarizeUploadQueueState();
      if (queueSummary.failed > 0) return 'FAILED';
      if (queueSummary.ready > 0 && queueSummary.ready + queueSummary.canceled === queueSummary.total && queueSummary.total > 0) return 'DRAFT READY';
      if (queueSummary.canceled > 0 && queueSummary.ready === 0) return 'CANCELED';
      if (state.uploadCreateReviewError) return 'FAILED';
      if (state.uploadCreateReviewLoading && state.uploadCreateReviewStage === 'Uploading file...') return 'UPLOADING';
      if (state.uploadCreateReviewLoading || state.uploadExtractionLoading) return 'EXTRACTING';
      if (state.uploadExtractionResult?.uploadId) return 'EXTRACTED';
      return 'READY';
    }
    if (tabId === 'previewImport') {
      if (state.uploadCreateReviewError) return 'FAILED';
      if (state.uploadPreviewPartial) return 'PARTIAL PREVIEW';
      if (state.uploadPrepareReviewFailedMode === 'preview') return 'FAILED';
      if (state.uploadPrepareReviewLoading && !state.uploadPreviewComplete) return 'PREVIEW RUNNING';
      if (state.uploadImportEstimate) return 'ESTIMATE READY';
      return 'WAITING';
    }
    if (tabId === 'reviewPreview') {
      if (state.uploadPreviewPartial) return 'PARTIAL PREVIEW';
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
    if (tabId === 'complete') {
      return state.reviewCompleted ? 'COMPLETE' : 'WAITING';
    }
    return 'WAITING';
  }

  function getSelectedDraftSummary() {
    return state.drafts.find((draft) => draft.packId === state.selectedDraftPackId) || null;
  }

  async function selectReviewQueuePack(packId) {
    const nextPackId = String(packId || '').trim();
    if (!nextPackId || nextPackId === state.selectedDraftPackId) return;
    state.selectedDraftPackId = nextPackId;
    clearDraftScopedReviewUiState();
    await loadSelectedDraftReport();
    render();
  }

  function openReviewItem(button) {
    const item = findReviewItem(button.dataset.section, Number(button.dataset.index));
    if (!item) {
      state.errors.push('Review item is no longer pending. Refresh the draft report.');
      render();
      return;
    }

    state.selectedReviewItem = item;
    state.selectedReviewEvidenceItem = null;
    render();
  }

  function updateReviewSelection(checkbox) {
    const itemKey = checkbox.getAttribute('data-review-selection-item-key') || reviewItemKey(checkbox.dataset.section, Number(checkbox.dataset.index));
    if (!itemKey) return;

    const selected = new Set(state.selectedReviewItemKeys);
    if (checkbox.checked) {
      selected.add(itemKey);
    } else {
      selected.delete(itemKey);
    }
    state.selectedReviewItemKeys = Array.from(selected);
    state.reviewBulkMessage = '';
    render();
  }

  function cancelReviewWorkflow() {
    state.selectedReviewItemKeys = [];
    state.selectedReviewItem = null;
    state.selectedReviewEvidenceItem = null;
    state.selectedReviewItemKeys = [];
    state.reviewBulkMessage = '';
    state.reviewBulkMessage = 'Review canceled. Uploaded source files and draft packs were left untouched.';
    state.reviewCompleted = false;
    state.activeTab = 'upload';
    setStatus('Review canceled. Uploads and drafts were preserved.');
    render();
  }

  async function acceptSelectedReviewItems() {
    const items = getVisibleReviewItems();
    const selected = items.filter((item) => state.selectedReviewItemKeys.includes(reviewItemKey(item.section, item.index)));
    const safeItems = selected.filter(isReviewItemSafeToAccept);
    const skipped = selected.length - safeItems.length;
    if (!safeItems.length) {
      state.reviewBulkMessage = selected.length
        ? `No valid selected items were accepted. Skipped ${formatNumber(skipped)} unreviewable selected item${skipped === 1 ? '' : 's'}.`
        : 'No valid items are selected for Accept Selected.';
      setStatus('No valid selected draft items to accept.');
      render();
      return;
    }

    await acceptReviewItems(safeItems, {
      actionLabel: 'Accept Selected',
      skipped,
      doneMessage: `Accepted ${formatNumber(safeItems.length)} selected valid item${safeItems.length === 1 ? '' : 's'}.`
    });
  }

  async function acceptAllReviewItems() {
    const items = getVisibleReviewItems();
    const safeItems = items.filter(isReviewItemSafeToAccept);
    const skipped = items.length - safeItems.length;
    if (!safeItems.length) {
      state.reviewBulkMessage = `Accept All found no valid draft items. Skipped ${formatNumber(skipped)} unreviewable item${skipped === 1 ? '' : 's'}.`;
      setStatus('No valid draft items to accept.');
      render();
      return;
    }

    await acceptReviewItems(safeItems, {
      actionLabel: 'Accept All',
      skipped,
      doneMessage: `Accepted ${formatNumber(safeItems.length)} valid draft item${safeItems.length === 1 ? '' : 's'}.`
    });
  }

  async function acceptReviewItems(items, options = {}) {
    if (!state.selectedDraftPackId || state.reviewActionLoading) return;
    const draftPackIdAtStart = state.selectedDraftPackId;
    state.reviewActionLoading = true;
    state.errors = [];
    state.reviewBulkMessage = `${options.actionLabel || 'Accept'} is approving valid draft items only.`;
    setStatus('Accepting valid draft items...');
    render();

    let accepted = 0;
    let latestReport = null;
    const failed = [];
    try {
      for (const item of items) {
        try {
          const payload = await fetchJson(ENDPOINTS.draftItemStatus(state.selectedDraftPackId, item.section, item.index), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewStatus: 'approved' })
          });
          const data = unwrap(payload);
          latestReport = data?.report || latestReport;
          accepted += 1;
        } catch (error) {
          failed.push(`${SECTION_LABELS[item.section] || item.section} item ${item.index}: ${error.message || 'Route error'}`);
        }
      }

      if (latestReport) state.report = latestReport;
      await refreshDraftLists();
      state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => {
        const item = findPendingItemByKey(key);
        return item && !items.some((acceptedItem) => reviewItemKey(acceptedItem.section, acceptedItem.index) === key);
      });
      reconcileSelectedReviewItem();
      const skipped = Number(options.skipped || 0);
      const skippedText = skipped
        ? ` Skipped ${formatNumber(skipped)} unreviewable item${skipped === 1 ? '' : 's'}: rejected, invalid, quarantined, repair-failed, or missing-required-field items are not accepted.`
        : '';
      const failedText = failed.length ? ` ${failed.length} item${failed.length === 1 ? '' : 's'} failed to update.` : '';
      if (state.selectedDraftPackId === draftPackIdAtStart) {
        state.reviewBulkMessage = `${options.doneMessage || `Accepted ${formatNumber(accepted)} valid draft item${accepted === 1 ? '' : 's'}.`}${skippedText}${failedText} Approved packs are saved for later and are not connected to student answers yet.`;
        if (failed.length) state.errors.push(...failed);
        if (accepted > 0) {
          const shouldAdvance = options.actionLabel === 'Accept All'
            || (options.actionLabel === 'Accept Selected' && getVisibleReviewItems().filter(isReviewItemSafeToAccept).length === 0);
          if (shouldAdvance) {
            const advanced = await moveToNextDraftNeedingReview(draftPackIdAtStart);
            if (!advanced) {
              state.reviewCompleted = true;
              state.activeTab = 'complete';
            }
          } else {
            state.activeTab = 'review';
          }
        }
        setStatus(state.reviewBulkMessage);
      }
    } catch (error) {
      if (state.selectedDraftPackId === draftPackIdAtStart) {
        state.errors.push(`${options.actionLabel || 'Accept'} failed: ${error.message || 'Route error'}`);
        state.reviewBulkMessage = `${options.actionLabel || 'Accept'} failed before promotion. No unreviewable items were approved.`;
      }
    } finally {
      state.reviewActionLoading = false;
      render();
    }
  }

  function closeReviewItem() {
    state.selectedReviewItem = null;
    render();
  }

  function openReviewEvidence(button) {
    const item = findReviewItem(button.dataset.section, Number(button.dataset.index));
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
    const draft = state.report?.draftPack || getSelectedDraftSummary();
    const summary = getReviewProgressSummary(draft);
    if (!state.selectedDraftPackId || state.promotionActionLoading || !canCreateApprovedPackFromCurrentReport(summary)) return;
    const importScope = getDraftImportScope(draft);

    if (importScope.sampleOnly || importScope.rangeLimited) {
      const scopeConfirmed = window.confirm(
        `${importScope.warning || `This draft only covers ${importScope.rangeLabel || 'a limited range'}. Run Full Import to process the whole document.`}\n\nPromote this ${importScope.sampleOnly ? 'sample-only' : 'range-limited'} draft anyway?`
      );
      if (!scopeConfirmed) return;
    }

    const confirmed = window.confirm(
      'This will create an approved knowledge pack from approved items only. Rejected items will stay out, and student answering will not change yet.'
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
      state.reviewCompleted = true;
      state.activeTab = 'complete';
      setStatus('Promoted successfully');
    } catch (error) {
      const routeErrors = Array.isArray(error.errors) && error.errors.length ? error.errors : [error.message || 'Route error'];
      state.errors.push(...routeErrors);
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
    clearUploadProgressError();
    setUploadProgress('Uploading', 'Reading file', 15, 'working');
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
      setUploadProgress('Extracting', 'Reading text', 35, 'working');
      const data = unwrap(payload);
      state.uploadExtractionResult = data || null;
      state.uploadContentName = state.uploadContentName || makeContentNameFromFileName(data?.originalFileName || state.selectedUploadFile?.name || '');
      state.uploadPrepareReviewMessage = data?.uploadId ? 'Prepare Review is ready.' : '';
      setUploadProgress('Ready to generate draft', '', 60, 'ready');
      clearUploadProgressError();
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
      setUploadProgressError('Upload failed', 'Upload/extraction', error, [
        'Try the upload again.',
        'Use a supported file type.'
      ]);
      setStatus('Upload extraction failed.');
    } finally {
      state.uploadExtractionLoading = false;
      render();
    }
  }

  async function createReviewDraftFromUpload() {
    if (!state.selectedUploadFiles.length || state.uploadCreateReviewLoading) return;
    if (!state.uploadImportProfile) {
      state.uploadImportProfileError = 'Select an import profile before analyzing the upload.';
      state.uploadImportProfileNeedsAttention = true;
      state.errors = [];
      setStatus('Select an import profile before analyzing.');
      render();
      return;
    }

    const queue = buildUploadQueueFromFiles(state.selectedUploadFiles, state.uploadContentName);
    state.uploadQueue = queue;
    state.uploadQueueRunning = true;
    state.uploadQueueCancelRequested = false;
    state.uploadCreateReviewLoading = true;
    state.uploadCreateReviewStage = 'Processing upload queue...';
    state.uploadCreateReviewError = '';
    state.uploadCreateReviewTimeline = makeStagedImportTimeline('Upload queue created');
    clearUploadProgressError();
    setUploadProgress('Waiting', `Queue has ${queue.length} file${queue.length === 1 ? '' : 's'}`, 5, 'working');
    state.uploadExtractionResult = null;
    state.uploadPrepareReviewMessage = '';
    state.uploadPrepareReviewHandoff = null;
    state.uploadImportEstimate = null;
    state.uploadAutoImportPlan = null;
    state.uploadPreviewReport = null;
    state.uploadPreviewComplete = false;
    state.uploadPrepareReviewFailedMode = '';
    state.uploadPrepareReviewLastFailure = null;
    state.uploadSelectedRangeStart = '1';
    state.uploadSelectedRangeEnd = '3';
    state.fullImportConfirmText = '';
    state.latestPrepareReviewSourceMatch = null;
    state.errors = [];
    setStatus('Running upload queue...');
    render();

    const completedPackIds = [];
    try {
      for (let index = 0; index < queue.length; index += 1) {
        if (state.uploadQueueCancelRequested) break;
        const queueItem = queue[index];
        const queueTotal = queue.length;
        await processUploadQueueItem(queueItem, index, queueTotal, completedPackIds);
      }
      if (state.uploadQueueCancelRequested) {
        markWaitingQueueItemsCanceled();
      }
      if (completedPackIds.length) {
        await refreshDraftLists();
        state.selectedDraftPackId = completedPackIds[completedPackIds.length - 1];
        await loadSelectedDraftReport();
      }
      const summary = summarizeUploadQueueState();
      state.uploadPrepareReviewMessage = buildUploadQueueSummaryMessage(summary);
      setUploadProgress(
        summary.failed > 0 ? 'Completed with failures' : summary.canceled > 0 ? 'Canceled remaining' : 'Queue complete',
        state.uploadPrepareReviewMessage,
        100,
        summary.failed > 0 ? 'error' : 'ready'
      );
      if (summary.failed > 0) {
        state.uploadCreateReviewError = `Queue finished with ${summary.failed} failed file${summary.failed === 1 ? '' : 's'}.`;
      }
      setStatus(state.uploadPrepareReviewMessage || 'Upload queue finished.');
    } catch (error) {
      state.uploadCreateReviewError = error?.message || 'Queue processing failed.';
      state.errors.push(`Create Review Draft failed: ${state.uploadCreateReviewError}`);
      setUploadProgressError('Upload queue failed', 'Queue processing', error, [
        'Retry the upload queue.',
        'Check that each file has extractable text.'
      ]);
      setStatus('Create Review Draft failed.');
    } finally {
      state.uploadQueueRunning = false;
      state.uploadCreateReviewLoading = false;
      render();
    }
  }

  function buildUploadQueueFromFiles(files, singleName = '') {
    const queueFiles = Array.from(files || []).filter(Boolean);
    const queue = queueFiles.map((file, index) => ({
      queueId: `upload-queue-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      file,
      fileName: file.name || `File ${index + 1}`,
      proposedPackName: queueFiles.length === 1 && singleName
        ? singleName
        : buildDefaultPackNameFromFile(file, file.name || `File ${index + 1}`),
      status: 'waiting',
      uploadId: '',
      packId: '',
      error: ''
    }));
    return makeQueuePackNamesCollisionSafe(queue);
  }

  function makeQueuePackNamesCollisionSafe(queue = []) {
    const counts = new Map();
    return queue.map((item) => {
      const baseName = String(item?.proposedPackName || '').trim()
        || makeContentNameFromFileName(item?.fileName || '');
      const seen = counts.get(baseName) || 0;
      counts.set(baseName, seen + 1);
      const proposedPackName = seen > 0 ? `${baseName} (${seen + 1})` : baseName;
      return {
        ...item,
        proposedPackName
      };
    });
  }

  function updateUploadQueueItem(queueId, updates = {}) {
    const index = state.uploadQueue.findIndex((item) => item.queueId === queueId);
    if (index < 0) return null;
    state.uploadQueue[index] = {
      ...state.uploadQueue[index],
      ...updates
    };
    return state.uploadQueue[index];
  }

  function markWaitingQueueItemsCanceled() {
    state.uploadQueue = state.uploadQueue.map((item) => {
      if (item.status === 'waiting') {
        return {
          ...item,
          status: 'canceled'
        };
      }
      return item;
    });
  }

  function summarizeUploadQueueState() {
    return state.uploadQueue.reduce((summary, item) => {
      const status = String(item?.status || '').toLowerCase();
      if (status === 'draft_ready') summary.ready += 1;
      else if (status === 'failed') summary.failed += 1;
      else if (status === 'canceled') summary.canceled += 1;
      return summary;
    }, { ready: 0, failed: 0, canceled: 0, total: state.uploadQueue.length });
  }

  function buildUploadQueueSummaryMessage(summary) {
    const parts = [];
    if (summary.ready > 0) {
      parts.push(`${summary.ready} draft${summary.ready === 1 ? '' : 's'} ready`);
    }
    if (summary.failed > 0) {
      parts.push(`${summary.failed} failed`);
    }
    if (summary.canceled > 0) {
      parts.push(`${summary.canceled} canceled`);
    }
    return parts.length ? parts.join(' • ') : 'No files were processed.';
  }

  async function processUploadQueueItem(queueItem, index, total, completedPackIds) {
    if (!queueItem || !queueItem.file) return;
    const queuePosition = `${index + 1}/${total}`;
    updateUploadQueueItem(queueItem.queueId, { status: 'extracting', error: '' });
    state.uploadCreateReviewStage = `Extracting ${queueItem.fileName}`;
    appendImportActivity('queue_extracting', `Extracting ${queueItem.fileName}`, {
      queuePosition,
      fileName: queueItem.fileName
    });
    setUploadProgress('Extracting', `File ${queuePosition}: ${queueItem.fileName}`, Math.max(10, Math.floor((index / Math.max(1, total)) * 80)), 'working');
    render();

    try {
      const formData = new FormData();
      formData.append('sourceFile', queueItem.file);
      formData.append('knowledgeName', queueItem.proposedPackName || makeContentNameFromFileName(queueItem.fileName));
      const extractionPayload = await fetchJson(ENDPOINTS.uploadAndPrepare, {
        method: 'POST',
        body: formData
      });
      const extractionData = unwrap(extractionPayload);
      const uploadData = extractionData?.upload || extractionData?.extraction || null;
      const uploadId = uploadData?.uploadId || '';
      if (!uploadId) {
        throw new Error('Upload ID missing after extraction.');
      }
      updateUploadQueueItem(queueItem.queueId, { status: 'processing', uploadId });
      applyImportTimeline(extractionData?.timeline || extractionPayload?.timeline);
      state.uploadExtractionResult = uploadData;
      state.uploadImportEstimate = extractionData?.importEstimate || null;
      state.uploadAutoImportPlan = extractionData?.autoImportPlan || null;
      setUploadProgress('Processing', `File ${queuePosition}: ${queueItem.fileName}`, Math.max(20, Math.floor(((index + 0.5) / Math.max(1, total)) * 85)), 'working');
      render();

      const preparePayload = await fetchJson(ENDPOINTS.uploadPrepareReview(uploadId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packName: queueItem.proposedPackName || makeContentNameFromFileName(queueItem.fileName),
          knowledgeName: queueItem.proposedPackName || makeContentNameFromFileName(queueItem.fileName),
          importProfile: normalizeImportProfileForPayload(state.uploadImportProfile),
          retryInvalidJson: true,
          importMode: 'full',
          mode: 'full',
          confirmFullImport: true,
          useAutoImportPlan: true,
          useRecommendedImportPlan: true
        })
      });
      const prepareData = unwrap(preparePayload);
      applyImportTimeline(prepareData?.timeline || preparePayload?.timeline);
      updateUploadQueueItem(queueItem.queueId, {
        status: 'draft_ready',
        packId: prepareData?.packId || '',
        error: ''
      });
      if (prepareData?.packId) {
        completedPackIds.push(prepareData.packId);
      }
      state.uploadPrepareReviewMessage = prepareData?.message || 'Review draft prepared.';
      state.uploadPrepareReviewHandoff = {
        packId: prepareData?.packId || '',
        title: prepareData?.title || '',
        sourceMatch: prepareData?.sourceMatch || null,
        reportRefreshFailed: false
      };
      state.latestPrepareReviewSourceMatch = prepareData?.sourceMatch || null;
      appendImportActivity('queue_draft_ready', `Draft ready for ${queueItem.fileName}`, {
        queuePosition,
        fileName: queueItem.fileName,
        packId: prepareData?.packId || ''
      });
    } catch (error) {
      updateUploadQueueItem(queueItem.queueId, {
        status: 'failed',
        error: error?.message || 'Queue item failed.'
      });
      appendImportActivity('queue_failed', `Failed: ${queueItem.fileName}`, {
        queuePosition,
        fileName: queueItem.fileName,
        errors: error?.data?.errors || [error?.message || 'Route error']
      });
      state.errors.push(`Upload failed for ${queueItem.fileName}: ${error?.message || 'Route error'}`);
    }
  }

  function cancelRemainingUploadQueue() {
    if (!state.uploadQueueRunning) return;
    state.uploadQueueCancelRequested = true;
    setStatus('Cancel requested. Remaining files will be marked canceled after the current file finishes.');
    appendImportActivity('queue_cancel_requested', 'Cancel requested for remaining files');
    render();
  }

  async function runPreviewImport() {
    return prepareReviewFromUpload('preview', makePreviewImportPayload());
  }

  async function runFullImport() {
    return prepareReviewFromUpload('full');
  }

  async function runSelectedImport(preset = 'range') {
    return prepareReviewFromUpload('selected', makeSelectedImportPayload(preset));
  }

  async function runRecommendedImport() {
    const plan = state.uploadAutoImportPlan || {};
    if (plan.mode === 'manual_review_needed') {
      const error = {
        message: 'This upload did not include enough extracted text to generate a draft.',
        data: {
          message: 'This upload did not include enough extracted text to generate a draft.',
          teacherFriendlyError: 'This upload did not include enough extracted text to generate a draft.',
          autoImportPlan: plan,
          importEstimate: state.uploadImportEstimate,
          warnings: plan.warnings || []
        }
      };
      state.uploadPrepareReviewLastFailure = {
        mode: 'selected',
        message: error.message,
        teacherFriendlyError: error.data.teacherFriendlyError,
        technicalErrors: plan.warnings || [],
        errors: [error.message],
        warnings: plan.warnings || [],
        uploadId: state.uploadExtractionResult?.uploadId || '',
        fileName: state.uploadExtractionResult?.originalFileName || '',
        extractionCounts: state.uploadImportEstimate || null
      };
      setUploadProgressError('Analysis failed', 'Draft generation', error, ['Try a source file with selectable text.']);
      setStatus('Analysis failed.');
      render();
      return;
    }
    return prepareReviewFromUpload('full', {
      useAutoImportPlan: true,
      useRecommendedImportPlan: true,
      confirmFullImport: true
    });
  }

  async function prepareReviewFromUpload(importMode = 'preview', extraBody = {}) {
    const uploadId = state.uploadExtractionResult?.uploadId;
    if (!uploadId || state.uploadPrepareReviewLoading) return;

    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const abortController = typeof AbortController === 'function' ? new AbortController() : null;
    state.uploadPrepareReviewLoading = true;
    state.uploadPrepareReviewAbortController = abortController;
    state.uploadPrepareReviewRequestId = requestId;
    state.uploadPrepareReviewStopped = false;
    state.uploadPrepareReviewFailedMode = '';
    state.uploadPrepareReviewLastFailure = null;
    clearUploadProgressError();
    setUploadProgress('Generating', getGenerateProgressDetail(importMode), 72, 'working');
    state.uploadPrepareReviewMessage = importMode === 'full'
      ? 'Import is running, do not close this window. Gemma is processing one batch at a time...'
      : importMode === 'selected'
        ? 'Importing selected pages with Gemma...'
      : 'Running a preview draft on a small sample...';
    state.errors = [];
    setStatus(importMode === 'full' ? 'Running full import...' : importMode === 'selected' ? 'Importing selected pages...' : 'Running preview draft...');
    render();

    const validatingTimer = window.setTimeout(() => {
      if (!isCurrentPrepareReviewRequest(requestId)) return;
      setUploadProgress('Validating', 'Checking draft', 92, 'working');
      render();
    }, 900);
    const waitingTooLongTimer = window.setTimeout(() => {
      if (!isCurrentPrepareReviewRequest(requestId)) return;
      setUploadProgress('Validating', 'Still waiting on the local model while adaptive analysis continues.', 92, 'working');
      render();
    }, 15000);

    try {
      const payload = await fetchJson(ENDPOINTS.uploadPrepareReview(uploadId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController?.signal,
        body: JSON.stringify({
          packName: state.uploadContentName || makeContentNameFromFileName(state.uploadExtractionResult?.originalFileName || ''),
          knowledgeName: state.uploadContentName || makeContentNameFromFileName(state.uploadExtractionResult?.originalFileName || ''),
          importProfile: normalizeImportProfileForPayload(state.uploadImportProfile),
          retryInvalidJson: true,
          importMode,
          mode: importMode,
          previewOnly: importMode === 'preview',
          confirmFullImportText: importMode === 'full' ? state.fullImportConfirmText : '',
          ...extraBody
        })
      });
      if (!isCurrentPrepareReviewRequest(requestId)) return;
      const data = unwrap(payload);
      applyImportTimeline(data?.timeline || payload?.timeline);
      state.uploadImportEstimate = data?.importEstimate || state.uploadImportEstimate;
      state.uploadAutoImportPlan = data?.autoImportPlan || state.uploadAutoImportPlan;
      if (data?.preview) {
        state.uploadPreviewReport = data.previewReport || null;
        state.uploadPreviewPartial = data.partialPreview === true || data.previewReport?.partialPreview === true;
        state.uploadPreviewComplete = !state.uploadPreviewPartial;
        state.activeTab = 'upload';
        state.uploadPrepareReviewMessage = data?.message || (state.uploadPreviewPartial ? 'Partial preview created. Some pages/chunks failed.' : 'Preview draft prepared. Review the sample before running full import.');
        setUploadProgress('Ready to generate draft', state.uploadPreviewPartial ? 'Check preview' : 'Preview ready', 60, 'ready');
        clearUploadProgressError();
        setStatus(state.uploadPreviewPartial ? 'Partial preview ready. Review before continuing.' : 'Preview draft ready.');
      } else {
        setUploadProgress('Validating', 'Checking draft', 94, 'working');
        await applyPreparedDraftResponse(data);
        state.activeTab = 'review';
        setUploadProgress('Ready for review', 'Almost ready', 100, 'ready');
        clearUploadProgressError();
        setStatus(importMode === 'selected' ? 'Selected range draft prepared.' : 'Review draft prepared.');
      }
    } catch (error) {
      if (state.uploadPrepareReviewStopped || error?.name === 'AbortError') {
        if (state.uploadPrepareReviewStopped) {
          state.uploadPrepareReviewMessage = 'Generation stopped. Upload and plan were preserved.';
        }
        return;
      }
      if (!isCurrentPrepareReviewRequest(requestId)) return;
      state.uploadPrepareReviewMessage = 'Prepare Review failed.';
      state.uploadPrepareReviewHandoff = null;
      state.uploadImportEstimate = error?.data?.importEstimate || state.uploadImportEstimate;
      state.uploadAutoImportPlan = error?.data?.autoImportPlan || state.uploadAutoImportPlan;
      state.uploadPrepareReviewFailedMode = importMode;
      state.uploadPrepareReviewLastFailure = {
        mode: importMode,
        message: error.message || 'Route error',
        teacherFriendlyError: normalizePrepareReviewFailureMessage(error?.data?.teacherFriendlyError || firstError(error?.data?.errors, error.message || 'Route error'), error?.data?.errors),
        technicalErrors: error?.data?.technicalErrors || [],
        errors: error?.data?.errors || [error.message || 'Route error'],
        warnings: error?.data?.warnings || [],
        validationErrors: error?.data?.validationErrors || [],
        invalidItems: error?.data?.invalidItems || [],
        repairNeeded: error?.data?.repairNeeded || [],
        uploadId: error?.data?.uploadId || uploadId,
        fileName: error?.data?.originalFileName || error?.data?.fileName || state.uploadExtractionResult?.originalFileName || '',
        sourceType: error?.data?.sourceType || state.uploadExtractionResult?.fileType || '',
        importSelection: error?.data?.importSelection || extraBody.importSelection || null,
        selectedRange: error?.data?.selectedRange || '',
        extractionCounts: error?.data?.extractionCounts || error?.data?.extractionSummary || null,
        extractionMetadata: error?.data?.extractionMetadata || error?.data?.extractionSummary?.metadata || state.uploadExtractionResult?.extraction?.metadata || null,
        rawModelResponsePath: error?.data?.rawModelResponsePath || '',
        failedBatches: error?.data?.failedBatches || []
      };
      applyImportTimeline(error?.data?.timeline || error?.timeline);
      appendImportActivity('error', state.uploadPrepareReviewLastFailure.teacherFriendlyError || state.uploadPrepareReviewLastFailure.message, {
        fileName: state.uploadPrepareReviewLastFailure.fileName,
        pageRange: formatImportSelectionRange(state.uploadPrepareReviewLastFailure.importSelection, state.uploadPrepareReviewLastFailure.selectedRange),
        characterCount: state.uploadPrepareReviewLastFailure.extractionCounts?.characterCount,
        pageCount: state.uploadPrepareReviewLastFailure.extractionCounts?.pageCount,
        chunkCount: state.uploadPrepareReviewLastFailure.extractionCounts?.chunkCount,
        errors: state.uploadPrepareReviewLastFailure.errors
      });
      state.errors.push(`Prepare Review failed: ${error.message || 'Route error'}`);
      setUploadProgressError('Draft generation failed', importMode === 'full' ? 'Full import' : importMode === 'selected' ? 'Selected range import' : 'Preview import', error, makePrepareReviewRecoverySuggestions(state.uploadPrepareReviewLastFailure));
      setStatus('Prepare Review failed.');
    } finally {
      window.clearTimeout(validatingTimer);
      window.clearTimeout(waitingTooLongTimer);
      if (state.uploadPrepareReviewRequestId === requestId || state.uploadPrepareReviewStopped) {
        state.uploadPrepareReviewLoading = false;
        state.uploadPrepareReviewAbortController = null;
        if (state.uploadPrepareReviewRequestId === requestId) state.uploadPrepareReviewRequestId = '';
        render();
      }
    }
  }

  function isCurrentPrepareReviewRequest(requestId) {
    return Boolean(state.uploadPrepareReviewLoading && state.uploadPrepareReviewRequestId === requestId);
  }

  function stopUploadGeneration() {
    if (!state.uploadPrepareReviewLoading) return;
    state.uploadPrepareReviewStopped = true;
    state.uploadPrepareReviewLoading = false;
    state.uploadPrepareReviewRequestId = '';
    if (state.uploadPrepareReviewAbortController) {
      state.uploadPrepareReviewAbortController.abort();
    }
    state.uploadPrepareReviewAbortController = null;
    state.uploadPrepareReviewMessage = 'Generation stopped. Upload and plan were preserved.';
    setUploadProgress('Ready to generate draft', 'Generation stopped. Upload and plan were preserved.', 60, 'ready');
    appendImportActivity('generation_stopped', 'Generation stopped. Upload and plan were preserved.');
    setStatus('Generation stopped. Upload and plan were preserved.');
    render();
  }

  function makeSelectedImportPayload(preset) {
    const estimate = state.uploadImportEstimate || {};
    const intent = preset === 'preview' ? 'preview_range' : 'selected_range';
    if (preset === 'first3') {
      state.uploadSelectedRangeStart = '1';
      state.uploadSelectedRangeEnd = String(Math.min(3, Number(estimate.pageCount || 3)));
    } else if (preset === 'next3') {
      const next = getNextThreePageRange();
      state.uploadSelectedRangeStart = String(next.start);
      state.uploadSelectedRangeEnd = String(next.end);
    } else if (preset === 'preview') {
      const start = Math.max(1, Number(state.uploadPreviewPageStart || 1));
      const pages = Number(state.uploadPreviewReport?.processedPageCount || estimate.previewMaxPages || 1);
      state.uploadSelectedRangeStart = String(start);
      state.uploadSelectedRangeEnd = String(Math.min(start + Math.max(0, pages - 1), Number(estimate.pageCount || start)));
    } else if (preset === 'firstSection') {
      return {
        selectedImport: true,
        importIntent: intent,
        selectedImportPreset: preset,
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
      importIntent: intent,
      selectedImportPreset: preset,
      importSelection: {
        pageStart,
        pageEnd
      }
    };
  }

  function makeRecommendedImportPayload(plan) {
    const firstBatch = Array.isArray(plan?.batches) ? plan.batches[0] : null;
    const pages = Array.isArray(firstBatch?.pageNumbers) ? firstBatch.pageNumbers.map(Number).filter((page) => Number.isFinite(page) && page > 0) : [];
    const pageStart = pages.length ? Math.min(...pages) : getFirstTextPage() || 1;
    const pageEnd = pages.length ? Math.max(...pages) : pageStart;
    return {
      selectedImport: true,
      useAutoImportPlan: true,
      useRecommendedImportPlan: true,
      importIntent: 'auto_recommended_selected_range',
      selectedImportPreset: 'auto_recommended',
      importSelection: {
        pageStart,
        pageEnd
      }
    };
  }

  function getTextBearingPages() {
    const estimate = state.uploadImportEstimate || {};
    const pages = Array.isArray(estimate.textBearingPages)
      ? estimate.textBearingPages
      : Array.isArray(estimate.pagesWithText)
        ? estimate.pagesWithText
        : [];
    return Array.from(new Set(pages.map(Number).filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b);
  }

  function getFirstTextPage() {
    const estimate = state.uploadImportEstimate || {};
    const first = Number(estimate.firstTextPage || getTextBearingPages()[0] || 0);
    return Number.isFinite(first) && first > 0 ? Math.floor(first) : 0;
  }

  function applyDefaultPreviewTextPage() {
    const firstTextPage = getFirstTextPage();
    if (firstTextPage > 1 && state.uploadPreviewSize === 'ultraSafe') {
      state.uploadPreviewPageStart = String(firstTextPage);
      state.uploadPreviewPageEnd = String(firstTextPage);
      state.uploadPreviewAutoTextPage = true;
    }
  }

  function makePreviewImportPayload() {
    const estimate = state.uploadImportEstimate || {};
    const maxPage = Math.max(1, Number(estimate.pageCount || estimate.previewMaxPages || 1));
    const size = state.uploadPreviewSize || (estimate.isLarge ? 'ultraSafe' : 'normal');
    const firstTextPage = getFirstTextPage();
    const requestedStart = size === 'ultraSafe' && state.uploadPreviewAutoTextPage && firstTextPage > 1
      ? firstTextPage
      : Number(state.uploadPreviewPageStart || 1);
    const pageStart = Math.max(1, Math.min(maxPage, requestedStart));
    const pageEnd = size === 'range'
      ? Math.max(pageStart, Math.min(maxPage, Number(state.uploadPreviewPageEnd || pageStart)))
      : pageStart;
    const maxChars = Math.max(200, Number(state.uploadPreviewCustomMaxChars || estimate.previewMaxCharacters || 1000));
    return {
      preview: true,
      previewOnly: true,
      previewSize: size,
      previewMode: size === 'ultraSafe' ? 'ultra-safe' : size === 'custom' ? 'custom' : 'normal',
      previewMaxPages: size === 'range' ? Math.max(1, pageEnd - pageStart + 1) : 1,
      previewMaxCharacters: maxChars,
      importSelection: {
        pageStart,
        pageEnd
      },
      selectedPages: Array.from({ length: pageEnd - pageStart + 1 }, (_unused, index) => pageStart + index)
    };
  }

  function applyPreviewRangeMode(mode) {
    const estimate = state.uploadImportEstimate || {};
    const maxPage = Math.max(1, Number(estimate.pageCount || 1));
    const firstTextPage = getFirstTextPage();
    if (mode === 'firstTextPage' && firstTextPage > 0) {
      state.uploadPreviewSize = 'ultraSafe';
      state.uploadPreviewPageStart = String(firstTextPage);
      state.uploadPreviewPageEnd = String(firstTextPage);
      state.uploadPreviewAutoTextPage = true;
      render();
      return;
    }
    if (mode === 'nextPage') {
      const current = Math.max(1, Number(state.uploadPreviewPageEnd || state.uploadPreviewPageStart || 1));
      const next = Math.min(maxPage, current + 1);
      state.uploadPreviewSize = 'custom';
      state.uploadPreviewPageStart = String(next);
      state.uploadPreviewPageEnd = String(next);
      state.uploadPreviewAutoTextPage = false;
      render();
      return;
    }
    state.uploadPreviewSize = 'ultraSafe';
    state.uploadPreviewPageStart = '1';
    state.uploadPreviewPageEnd = '1';
    state.uploadPreviewAutoTextPage = false;
    render();
  }

  function retryPreviewWithSmallerLimit() {
    const current = Number(state.uploadPreviewReport?.maxPreviewChars || state.uploadPreviewCustomMaxChars || 1000);
    state.uploadPreviewSize = 'ultraSafe';
    state.uploadPreviewCustomMaxChars = String(Math.max(200, Math.floor(current / 2)));
    runPreviewImport();
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
    state.selectedReviewItemKeys = [];
    state.reviewListFilter = 'all';
    state.reviewNeedsReviewExpanded = false;
    state.reviewCompleted = false;
    clearStaleReviewCanceledMessage();
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
    const [dashboardResult, draftsResult, uploadHistoryResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.uploadHistory)
    ]);
    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(uploadHistoryResult, 'uploadHistory');
  }

  async function refreshTeacherContentSummaries() {
    const [dashboardResult, draftsResult, approvedResult, uploadHistoryResult] = await Promise.allSettled([
      fetchJson(ENDPOINTS.dashboard),
      fetchJson(ENDPOINTS.drafts),
      fetchJson(ENDPOINTS.approved),
      fetchJson(ENDPOINTS.uploadHistory)
    ]);
    applySettledResult(dashboardResult, 'dashboard');
    applySettledResult(draftsResult, 'drafts');
    applySettledResult(approvedResult, 'approved');
    applySettledResult(uploadHistoryResult, 'uploadHistory');
    await loadSelectedDraftReport();
  }

  async function toggleApprovedPackActivation(button) {
    const packId = button.getAttribute('data-approved-pack-id') || '';
    if (!packId || state.approvedActivationSaving[packId]) return;

    const pack = state.approved.find((item) => item.packId === packId);
    const enabled = button.matches?.('input[type="checkbox"]') ? button.checked === true : !(pack && pack.activationEnabled === true);
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

  async function deleteApprovedPack(button) {
    const packId = button.getAttribute('data-approved-pack-id') || '';
    if (!packId || state.approvedDeleteSaving[packId]) return;

    const pack = state.approved.find((item) => item.packId === packId) || {};
    const confirmationTarget = pack.title || packId;
    const confirmationText = window.prompt(
      `Type DELETE to archive "${confirmationTarget}". Uploaded source files and draft packs will not be deleted.`
    );
    if (confirmationText === null) return;

    state.approvedDeleteSaving = { ...state.approvedDeleteSaving, [packId]: true };
    state.approvedDeleteMessages = { ...state.approvedDeleteMessages, [packId]: 'Deleting approved pack...' };
    setStatus('Deleting approved pack...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.approvedDelete(packId), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText })
      });
      const data = unwrap(payload);
      state.approvedDeleteMessages = {};
      if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
      await refreshTeacherContentSummaries();
      setStatus(data?.message || 'Approved pack archived. Uploaded source files and draft packs were left untouched.');
    } catch (error) {
      state.approvedDeleteMessages = {
        ...state.approvedDeleteMessages,
        [packId]: `Delete failed: ${error.message || 'Route error'}`
      };
      setStatus('Delete approved pack failed.');
    } finally {
      state.approvedDeleteSaving = { ...state.approvedDeleteSaving, [packId]: false };
      render();
    }
  }

  function toggleApprovedPackSelection(checkbox) {
    const packId = checkbox.getAttribute('data-approved-pack-id') || '';
    if (!packId) return;

    const selected = new Set(state.selectedApprovedPackIds);
    if (checkbox.checked) {
      selected.add(packId);
    } else {
      selected.delete(packId);
    }
    state.selectedApprovedPackIds = Array.from(selected).filter((selectedPackId) => {
      return state.approved.some((pack) => pack.packId === selectedPackId);
    });
    state.approvedBulkDeleteMessage = '';
    render();
  }

  async function deleteSelectedApprovedPacks() {
    const selectedPacks = state.selectedApprovedPackIds
      .map((packId) => state.approved.find((pack) => pack.packId === packId))
      .filter(Boolean);
    if (!selectedPacks.length || state.approvedBulkDeleteSaving) return;

    const selectedList = selectedPacks
      .map((pack) => `${pack.title || 'Approved pack'} (${pack.packId})`)
      .join('\n');
    const confirmationText = window.prompt(
      `Type DELETE to archive these approved knowledge packs:\n\n${selectedList}\n\nUploaded source files and draft packs will not be deleted.`
    );
    if (confirmationText === null) return;

    state.approvedBulkDeleteSaving = true;
    state.approvedBulkDeleteMessage = 'Deleting selected approved packs...';
    setStatus('Deleting selected approved packs...');
    render();

    try {
      const payload = await fetchJson(ENDPOINTS.approvedBulkDelete, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packIds: selectedPacks.map((pack) => pack.packId),
          confirmationText
        })
      });
      const data = unwrap(payload);
      state.selectedApprovedPackIds = [];
      state.approvedDeleteMessages = {};
      state.approvedBulkDeleteMessage = data?.message || 'Selected approved packs archived. Uploaded source files and draft packs were left untouched.';
      if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
      await refreshTeacherContentSummaries();
      setStatus(state.approvedBulkDeleteMessage);
    } catch (error) {
      state.approvedBulkDeleteMessage = `Delete selected failed: ${error.message || 'Route error'}`;
      setStatus('Delete selected approved packs failed.');
    } finally {
      state.approvedBulkDeleteSaving = false;
      render();
    }
  }

  function toggleApprovedPackDetails(button) {
    const packId = button.getAttribute('data-approved-pack-id') || '';
    if (!packId) return;
    const matchingDraft = state.drafts.find((draft) => String(draft?.packId || '') === packId);
    if (matchingDraft) {
      openDraftPackForReview(packId);
      return;
    }
    openOverlay().then(() => {
      setStatus('This approved pack is view-only here. Edit draft content before approval.');
      render();
    });
  }

  function applyApprovedSummary(data) {
    state.approved = Array.isArray(data?.approvedPacks) ? data.approvedPacks : [];
    state.selectedApprovedPackIds = state.selectedApprovedPackIds.filter((packId) => {
      return state.approved.some((pack) => pack.packId === packId);
    });
    state.approvedIndexedCounts = data?.indexedCounts || null;
    state.approvedSearchableCounts = data?.searchableCounts || null;
    collectApiIssues(data);
  }

  function reconcileSelectedReviewItem() {
    if (state.selectedReviewItem) {
      const next = findReviewItem(state.selectedReviewItem.section, Number(state.selectedReviewItem.index));
      state.selectedReviewItem = next || null;
    }
    if (state.selectedReviewEvidenceItem) {
      const nextEvidence = findReviewItem(state.selectedReviewEvidenceItem.section, Number(state.selectedReviewEvidenceItem.index));
      state.selectedReviewEvidenceItem = nextEvidence || null;
    }
    const visibleKeys = new Set(getVisibleReviewItems().map((item) => reviewItemKey(item.section, item.index)));
    state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => visibleKeys.has(key));
  }

  function findReviewItem(section, index) {
    const items = getReviewItemGroups()[section] || [];
    return items.find((item) => Number(item.index) === Number(index)) || null;
  }

  function findPendingItemByKey(key) {
    return getVisibleReviewItems().find((item) => reviewItemKey(item.section, item.index) === key) || null;
  }

  function getVisibleReviewItems() {
    const groups = getReviewItemGroups();
    return REVIEW_GROUP_ORDER
      .flatMap((sectionName) => Array.isArray(groups[sectionName]) ? groups[sectionName] : [])
      .filter((item) => isItemNeedingTeacherReview(item));
  }

  function getItemReviewWorkflowStatus(item) {
    if (!item || typeof item !== 'object') return '';
    return [item.reviewStatus, item.status, item.workflowStatus, item.approvalStatus]
      .map((value) => String(value || '').trim().toLowerCase())
      .find(Boolean) || '';
  }

  function isItemNeedingTeacherReview(item) {
    return isPendingReviewStatus(getItemReviewWorkflowStatus(item));
  }

  function isPendingReviewStatus(reviewStatus) {
    const normalized = String(reviewStatus || '').trim().toLowerCase();
    return normalized === 'pending' || normalized === 'needs_review' || normalized === 'needs-review';
  }

  function reviewItemKey(section, index) {
    if (!section && !Number.isInteger(index)) return '';
    return `${section}:${Number(index)}`;
  }

  function isReviewItemSafeToAccept(item) {
    if (!item || !isItemNeedingTeacherReview(item)) return false;
    if (hasMissingRequiredReviewFields(item)) return false;
    const unsafeText = [
      item.validationStatus,
      item.repairStatus,
      item.quarantineStatus,
      item.warningStatus,
      item.extractionStatus,
      item.modelStatus,
      item.status,
      ...(Array.isArray(item.validationErrors) ? item.validationErrors : []),
      ...(Array.isArray(item.warnings) ? item.warnings : [])
    ].filter(Boolean).join(' ').toLowerCase();
    if (/\b(rejected|reject|quarantine|quarantined|invalid|repair[_ -]?failed|missing required)\b/.test(unsafeText)) {
      return false;
    }
    return true;
  }

  function hasMissingRequiredReviewFields(item) {
    if (!item || typeof item !== 'object') return true;
    const requiredBySection = {
      vocabulary: ['term'],
      concepts: ['title'],
      referenceFormulas: ['title', 'equation'],
      problemBank: ['question'],
      standardsMap: ['standardId'],
      smokeTests: ['question']
    };
    const required = requiredBySection[item.section] || [];
    if (required.some((field) => !String(item[field] || '').trim())) return true;
    if (!String(item.sourceFile || '').trim()) return true;
    if (!String(item.sourceLocation || '').trim()) return true;
    if (!String(item.sourceTextSnippet || '').trim()) return true;
    return false;
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

  function formatTextBearingPages(pages) {
    const unique = Array.from(new Set((Array.isArray(pages) ? pages : []).map(Number).filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b);
    if (!unique.length) return '';
    const visible = unique.slice(0, 6).join(', ');
    return unique.length > 6 ? `${visible}...` : visible;
  }

  function renderImportEstimatePanel() {
    const estimate = state.uploadImportEstimate;
    if (!estimate) return '';
    const warning = estimate.hardStopMessage || estimate.warning || '';
    const textPages = Array.isArray(estimate.textBearingPages) ? estimate.textBearingPages : estimate.pagesWithText;
    const textPageList = formatTextBearingPages(textPages);
    return `
      <section class="teacher-content-import-estimate ${estimate.isLarge ? 'large' : ''}" data-import-estimate-panel>
        <div class="teacher-content-card-head">
          <div>
            <h5>Import Estimate</h5>
            <p>Review size before Gemma runs.</p>
          </div>
          <span class="teacher-content-pill ${estimate.hardStop ? 'blocked' : estimate.isLarge ? 'review' : 'ready'}">${estimate.hardStop ? 'Large' : estimate.isLarge ? 'Needs review' : 'Ready'}</span>
        </div>
        <div class="teacher-content-metric-grid">
          ${metric('File Name', estimate.fileName, 'data-import-estimate-file-name')}
          ${metric('Character Count', formatNumber(estimate.characterCount), 'data-import-estimate-character-count')}
          ${metric('Page Count', formatNumber(estimate.pageCount), 'data-import-estimate-page-count')}
          ${metric('Chunk Count', formatNumber(estimate.chunkCount), 'data-import-estimate-chunk-count')}
          ${textPageList ? metric('Pages with Text', textPageList, 'data-import-estimate-pages-with-text') : ''}
          ${estimate.firstTextPage ? metric('First Text Page', formatNumber(estimate.firstTextPage), 'data-import-estimate-first-text-page') : ''}
          ${metric('Estimated Gemma Batches', formatNumber(estimate.estimatedGemmaBatches), 'data-import-estimate-batch-count')}
          ${metric('Max Chars Per Batch', formatNumber(estimate.maxCharsPerBatch), 'data-import-estimate-max-chars')}
        </div>
        ${warning ? `<p class="profile-empty-state" data-import-estimate-warning>${escapeHtml(warning)}</p>` : ''}
      </section>
    `;
  }

  function renderAutoImportPlanPanel() {
    const plan = state.uploadAutoImportPlan;
    if (!plan) return '';
    const scopeLabel = plan.recommendedImportScope === 'full_document'
      ? 'Recommended: Full document import'
      : plan.recommendedImportScope === 'selected_range'
        ? 'Recommended: Selected range import'
        : plan.mode === 'manual_review_needed'
          ? 'Recommended: Manual review needed'
          : 'Recommended: Preview sample';
    const warnings = Array.isArray(plan.warnings) ? plan.warnings : [];
    return `
      <section class="teacher-content-import-estimate ${plan.mode === 'manual_review_needed' ? 'large' : ''}" data-auto-import-plan-panel>
        <div class="teacher-content-card-head">
          <div>
            <h5>${escapeHtml(scopeLabel)}</h5>
            <p data-auto-import-plan-reason>Reason: ${escapeHtml(plan.reason || 'The upload was inspected after extraction.')}</p>
          </div>
          <span class="teacher-content-pill ${plan.mode === 'manual_review_needed' ? 'blocked' : plan.recommendedImportScope === 'full_document' ? 'ready' : 'review'}">${escapeHtml(plan.batchStrategy || 'manual')}</span>
        </div>
        <div class="teacher-content-metric-grid">
          ${metric('Estimated batches', formatNumber(plan.batchCount), 'data-auto-import-plan-batches')}
          ${metric('Recommended scope', humanizeImportScope(plan.recommendedImportScope), 'data-auto-import-plan-scope')}
          ${metric('Available RAM', `${formatNumber(plan.limits?.availableMemoryMb)} MB`, 'data-auto-import-plan-available-memory')}
          ${metric('Max chars/batch', formatNumber(plan.limits?.maxCharactersPerBatch), 'data-auto-import-plan-max-chars')}
        </div>
        ${warnings.length ? `<div data-auto-import-plan-warnings>${renderIssueList('Warnings', warnings)}</div>` : ''}
        <p class="teacher-content-upload-note" data-auto-import-plan-override>You can override this if needed.</p>
      </section>
    `;
  }

  function renderRecommendedImportAction(canRunRecommended) {
    const plan = state.uploadAutoImportPlan || {};
    const disabled = canRunRecommended && plan.mode !== 'manual_review_needed' ? '' : 'disabled';
    return `
      <div class="teacher-content-import-actions" data-recommended-import-action>
        <button type="button" class="small-button" data-upload-run-recommended-import ${disabled}>${state.uploadPrepareReviewLoading ? 'Running analysis...' : 'Run automatic analysis'}</button>
      </div>
    `;
  }

  function humanizeImportScope(scope) {
    if (scope === 'full_document') return 'Full document';
    if (scope === 'selected_range') return 'Selected range';
    if (scope === 'preview_sample') return 'Preview sample';
    return scope || 'Manual';
  }

  function renderPreviewSizeControls(canRunPreview) {
    const estimate = state.uploadImportEstimate || {};
    const maxPage = Number(estimate.pageCount || 1);
    const start = Math.max(1, Number(state.uploadPreviewPageStart || 1));
    const end = Math.max(start, Number(state.uploadPreviewPageEnd || start));
    const size = state.uploadPreviewSize || (estimate.isLarge ? 'ultraSafe' : 'normal');
    const custom = size === 'custom';
    const range = size === 'range';
    const firstTextPage = getFirstTextPage();
    const firstPageHasNoText = firstTextPage > 1;
    return `
      <section class="teacher-content-preview-controls" data-preview-size-controls>
        <div class="teacher-content-card-head">
          <div>
            <h5>Preview Size</h5>
            <p>Ultra-safe uses one page, one chunk, and one model call.</p>
          </div>
          <span class="teacher-content-pill ${size === 'ultraSafe' ? 'ready' : range ? 'review' : 'muted'}">${size === 'ultraSafe' ? 'Ultra-safe' : range ? 'More demanding' : 'Preview'}</span>
        </div>
        <label class="teacher-content-name-field" for="teacherContentPreviewSize">
          <span>Preview size</span>
          <select id="teacherContentPreviewSize" ${canRunPreview ? '' : 'disabled'}>
            <option value="ultraSafe" ${size === 'ultraSafe' ? 'selected' : ''}>Ultra-safe</option>
            <option value="normal" ${size === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="custom" ${custom ? 'selected' : ''}>Custom single page</option>
            <option value="range" ${range ? 'selected' : ''}>Custom page range - more demanding</option>
          </select>
        </label>
        <div class="teacher-content-import-actions">
          <button type="button" class="small-button secondary-small" data-preview-range-mode="page1" ${canRunPreview ? '' : 'disabled'}>Page 1 only</button>
          ${firstTextPage ? `<button type="button" class="small-button secondary-small" data-preview-range-mode="firstTextPage" data-use-first-text-page ${canRunPreview ? '' : 'disabled'}>Use first text page</button>` : ''}
          <button type="button" class="small-button secondary-small" data-preview-range-mode="nextPage" ${canRunPreview ? '' : 'disabled'}>Next page</button>
        </div>
        <div class="teacher-content-range-row">
          <label class="teacher-content-name-field" for="teacherContentPreviewPageStart">
            <span>${range ? 'Start Page' : 'Page'}</span>
            <input id="teacherContentPreviewPageStart" type="number" min="1" max="${escapeAttr(maxPage)}" value="${escapeAttr(start)}" ${canRunPreview ? '' : 'disabled'}>
          </label>
          ${range ? `
            <label class="teacher-content-name-field" for="teacherContentPreviewPageEnd">
              <span>End Page</span>
              <input id="teacherContentPreviewPageEnd" type="number" min="1" max="${escapeAttr(maxPage)}" value="${escapeAttr(end)}" ${canRunPreview ? '' : 'disabled'}>
            </label>
          ` : ''}
          <label class="teacher-content-name-field" for="teacherContentPreviewMaxChars">
            <span>Max preview chars</span>
            <input id="teacherContentPreviewMaxChars" type="number" min="200" step="100" value="${escapeAttr(state.uploadPreviewCustomMaxChars || estimate.previewMaxCharacters || 1000)}" ${canRunPreview && (custom || size === 'ultraSafe') ? '' : 'disabled'}>
          </label>
        </div>
        ${firstPageHasNoText ? `<p class="teacher-content-upload-note" data-preview-first-text-page-note>Page 1 has no extractable text. Try Page ${escapeHtml(firstTextPage)}, the first page with extracted text.</p>` : ''}
        <p class="teacher-content-upload-note" data-preview-size-note>${range ? 'Custom page ranges are more demanding and may use multiple Gemma calls.' : firstPageHasNoText ? `Default ultra-safe preview uses Page ${escapeHtml(firstTextPage)}, the first page with extracted text.` : 'Default preview is page 1 only.'}</p>
      </section>
    `;
  }

  function renderPreviewReportPanel() {
    const report = state.uploadPreviewReport;
    if (!report) return '';
    const counts = report.itemCounts || {};
    const deduplication = report.deduplication || {};
    const partial = report.partialPreview === true || state.uploadPreviewPartial;
    const importScope = report.importScope || report.pack?.metadata?.importScope || {};
    return `
      <section class="teacher-content-preview-report ${partial ? 'partial' : ''}" data-import-preview-report>
        <div class="teacher-content-card-head">
          <div>
            <h5>Preview Draft</h5>
            <p>${partial ? 'Partial preview created. Some pages/chunks failed.' : 'Temporary sample only. No final approved pack was created.'}</p>
          </div>
          <span class="teacher-content-pill ${partial ? 'review' : 'ready'}">${partial ? 'Partial preview' : 'Preview ready'}</span>
        </div>
        ${partial ? '<p class="profile-empty-state" data-partial-preview-warning>Partial preview created. Some pages/chunks failed. Full Import remains disabled until this is reviewed or retried successfully.</p>' : ''}
        ${renderImportScopeWarning({ ...importScope, sampleOnly: true, rangeLimited: true }, 'preview')}
        <div class="teacher-content-metric-grid">
          ${metric('Draft Scope', formatImportScopeLabel({ ...importScope, scopeLabel: importScope.scopeLabel || 'Preview Sample' }), 'data-preview-scope')}
          ${metric('Preview Mode', report.previewMode || 'Normal', 'data-preview-mode')}
          ${metric('Max Preview Chars', formatNumber(report.maxPreviewChars || state.uploadPreviewCustomMaxChars || 1000), 'data-preview-max-chars')}
          ${metric('Preview Pages', formatNumber(report.processedPageCount), 'data-preview-page-count')}
          ${metric('Preview Characters', formatNumber(report.processedCharacterCount), 'data-preview-character-count')}
          ${metric('Preview Chunks', formatNumber(report.processedChunkCount), 'data-preview-chunk-count')}
          ${metric('Vocabulary', formatNumber(counts.vocabulary), 'data-preview-vocabulary-count')}
          ${metric('Concepts', formatNumber(counts.concepts), 'data-preview-concepts-count')}
          ${metric('Problems', formatNumber(counts.problemBank), 'data-preview-problem-count')}
        </div>
        ${Array.isArray(report.failedBatches) && report.failedBatches.length ? renderFailedBatchSummary(report.failedBatches) : ''}
        ${renderPreviewRepairDetails(report)}
        ${renderPreviewPackItems(report.pack)}
        ${partial ? renderModelCrashGuidance(report) : ''}
        ${renderPreviewDeduplicationDetails(deduplication)}
      </section>
    `;
  }

  function renderPreviewRepairDetails(report) {
    const invalidItems = Array.isArray(report.invalidItems) ? report.invalidItems : [];
    const repairNeeded = Array.isArray(report.repairNeeded) ? report.repairNeeded : invalidItems;
    const validationErrors = Array.isArray(report.validationErrors) ? report.validationErrors : Array.isArray(report.errors) ? report.errors : [];
    if (!invalidItems.length && !repairNeeded.length && !validationErrors.length) return '';
    return `
      <div class="teacher-content-preview-repair" data-preview-repair-needed>
        <h5>Repair-needed items</h5>
        ${validationErrors.length ? `
          <div data-preview-validation-errors>
            <strong>Validation errors</strong>
            <ul>${validationErrors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${invalidItems.length ? `
          <ul data-preview-invalid-items>
            ${invalidItems.map((entry) => `
              <li>
                ${escapeHtml(`${SECTION_LABELS[entry.section] || titleCase(entry.section || 'item')} #${Number(entry.index || 0) + 1}`)}:
                ${escapeHtml(Array.isArray(entry.errors) ? entry.errors.join('; ') : 'Validation failed.')}
              </li>
            `).join('')}
          </ul>
        ` : '<p class="profile-empty-state">No invalid preview items were reported.</p>'}
      </div>
    `;
  }

  function renderPreviewPackItems(pack) {
    if (!pack || typeof pack !== 'object') return '';
    const sections = ['vocabulary', 'concepts', 'referenceFormulas', 'problemBank', 'standardsMap', 'smokeTests'];
    const rows = sections.flatMap((sectionName) => {
      const items = Array.isArray(pack[sectionName]) ? pack[sectionName] : [];
      return items.map((item, index) => ({
        sectionName,
        index,
        label: previewItemLabel(sectionName, item),
        source: item && (item.sourceLocation || item.sourceFile || item.sourceTextSnippet)
      }));
    });
    if (!rows.length) return '';
    return `
      <div class="teacher-content-preview-items" data-preview-valid-items>
        <h5>Valid preview items kept</h5>
        <ul>
          ${rows.slice(0, 8).map((row) => `
            <li>
              <strong>${escapeHtml(SECTION_LABELS[row.sectionName] || titleCase(row.sectionName))}</strong>
              <span>${escapeHtml(row.label || `Item ${row.index + 1}`)}</span>
              ${row.source ? `<small>${escapeHtml(row.source)}</small>` : ''}
            </li>
          `).join('')}
        </ul>
        ${rows.length > 8 ? `<p class="teacher-content-upload-note">${escapeHtml(formatNumber(rows.length - 8))} more valid preview items kept.</p>` : ''}
      </div>
    `;
  }

  function previewItemLabel(sectionName, item) {
    if (!item || typeof item !== 'object') return '';
    if (sectionName === 'vocabulary') return item.term || item.vocabId || '';
    if (sectionName === 'concepts') return item.title || item.conceptId || '';
    if (sectionName === 'referenceFormulas') return item.title || item.formulaId || item.equation || '';
    if (sectionName === 'problemBank') return item.question || item.problemId || '';
    if (sectionName === 'standardsMap') return item.standardId || item.description || '';
    if (sectionName === 'smokeTests') return item.question || item.expectedAnswer || item.expectedRoute || '';
    return '';
  }

  function renderModelCrashGuidance(report) {
    const model = report.model ? ` Current model: ${report.model}.` : '';
    const limit = report.maxPreviewChars ? ` Current preview character limit: ${formatNumber(report.maxPreviewChars)}.` : '';
    return `
      <section class="teacher-content-issues blocked" data-model-crash-guidance>
        <h5>Local Gemma crashed</h5>
        <p>Local Gemma crashed. This is usually a model/runtime resource issue, not a PDF issue.${escapeHtml(model)}${escapeHtml(limit)}</p>
        <p>Try ultra-safe preview, a smaller model, or a lower preview character limit.</p>
      </section>
    `;
  }

  function renderPreviewDeduplicationDetails(deduplication) {
    const sections = ['vocabulary', 'concepts', 'problemBank'];
    const rows = sections
      .map((sectionName) => ({
        label: SECTION_LABELS[sectionName] || titleCase(sectionName),
        stats: deduplication && deduplication[sectionName]
      }))
      .filter((entry) => entry.stats);
    if (!rows.length) return '';
    return `
      <div class="teacher-content-preview-dedup" data-preview-deduplication-counts>
        ${rows.map((entry) => `
          <small data-preview-deduplication-row>
            ${escapeHtml(entry.label)} raw ${formatNumber(entry.stats.raw)} | duplicates ${formatNumber(entry.stats.duplicatesRemoved)} | final ${formatNumber(entry.stats.final)}
          </small>
        `).join('')}
      </div>
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
        <summary>Full document import confirmation</summary>
        <p class="profile-empty-state" data-full-import-gemma-warning>Whole-packet import processes every estimated batch sequentially and can overload local Gemma on large uploads.</p>
        ${largeFullImport ? `
          <label class="teacher-content-name-field" for="teacherContentFullImportConfirm" data-full-import-confirmation>
            <span>Type CONFIRM</span>
            <input id="teacherContentFullImportConfirm" type="text" value="${escapeAttr(state.fullImportConfirmText)}" placeholder="CONFIRM">
          </label>
        ` : ''}
        <p class="teacher-content-upload-note">Use the Run Full Document Import button above after confirmation is satisfied.</p>
      </details>
    `;
  }

  function getPreviewImportNote() {
    const timeline = Array.isArray(state.uploadCreateReviewTimeline) ? state.uploadCreateReviewTimeline : [];
    const gemmaReturnedItems = timeline.some((entry) => entry && entry.type === 'batch_received');
    const normalized = timeline.some((entry) => entry && entry.type === 'normalization_complete');
    if (normalized) {
      return 'Gemma returned draft items. Charlemagne normalized IDs/titles and kept items pending review.';
    }
    if (gemmaReturnedItems && state.uploadPrepareReviewLastFailure) {
      return 'Gemma returned draft items, but validation found fields that need repair.';
    }
    return 'Gemma has not run yet. Preview Draft uses a small sample so you can check the import shape before a slower full import.';
  }

  function renderPrepareReviewFailurePanel(mode) {
    const failure = state.uploadPrepareReviewLastFailure;
    if (!failure || (mode && failure.mode !== mode)) return '';
    const isPreview = failure.mode === 'preview';
    const teacherMessage = failure.teacherFriendlyError || failure.message || 'Prepare Review failed.';
    const technical = Array.isArray(failure.technicalErrors) && failure.technicalErrors.length
      ? failure.technicalErrors
      : Array.isArray(failure.errors) ? failure.errors.slice(1) : [];
    const backendDetails = makePrepareReviewBackendDetails(failure);
    const suggestions = makePrepareReviewRecoverySuggestions(failure);
    return `
      <section class="teacher-content-issues blocked teacher-content-recovery-panel" data-prepare-review-failure-message data-full-import-failure-message data-preview-retry-panel>
        <div>
          <h5>${isPreview ? 'Preview failed' : 'Full import failed'}</h5>
          <p>${escapeHtml(teacherMessage)}</p>
        </div>
        ${suggestions.length ? `
          <div class="teacher-content-backend-details" data-prepare-review-retry-guidance>
            <strong>Suggested next steps</strong>
            <ul>${suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('')}</ul>
          </div>
        ` : ''}
        ${Array.isArray(failure.failedBatches) && failure.failedBatches.length ? renderFailedBatchSummary(failure.failedBatches) : ''}
        ${renderPrepareReviewFailureItemDetails(failure)}
        ${isPreview ? `
          <div class="teacher-content-import-actions">
            <button type="button" class="small-button" data-upload-run-preview ${state.uploadPrepareReviewLoading ? 'disabled' : ''}>Retry Preview Draft</button>
            ${getFirstTextPageFromFailure(failure) ? `<button type="button" class="small-button secondary-small" data-preview-range-mode="firstTextPage" data-use-first-text-page ${state.uploadPrepareReviewLoading ? 'disabled' : ''}>Use first text page</button>` : ''}
            <button type="button" class="small-button secondary-small" data-handoff-tab="upload">Return to Upload / Start</button>
          </div>
        ` : ''}
        ${technical.length || failure.rawModelResponsePath ? `
          <details class="teacher-content-upload-details teacher-content-backend-details" data-full-import-technical-details data-prepare-review-backend-details>
            <summary>Technical details</summary>
            ${backendDetails.length ? `<ul>${backendDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}
            ${technical.length ? `<ul>${technical.map((item) => `<li>${escapeHtml(formatBackendDetail(item))}</li>`).join('')}</ul>` : ''}
            ${failure.rawModelResponsePath ? `<p class="teacher-content-upload-note">Raw model response: ${escapeHtml(failure.rawModelResponsePath)}</p>` : ''}
          </details>
        ` : backendDetails.length ? `
          <details class="teacher-content-upload-details teacher-content-backend-details" data-full-import-technical-details data-prepare-review-backend-details>
            <summary>Technical details</summary>
            <ul>${backendDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
          </details>
        ` : ''}
      </section>
    `;
  }

  function normalizePrepareReviewFailureMessage(message, errors = []) {
    const combined = [message, ...(Array.isArray(errors) ? errors : [])].join(' ').toLowerCase();
    if (combined.includes('no usable preview items')) {
      return 'Gemma did not return any usable preview items from this range.';
    }
    return message || 'Prepare Review failed.';
  }

  function makePrepareReviewBackendDetails(failure) {
    const details = [];
    if (failure.fileName) details.push(`File: ${failure.fileName}`);
    if (failure.uploadId) details.push(`Upload ID: ${failure.uploadId}`);
    if (failure.sourceType) details.push(`Source type: ${failure.sourceType}`);
    const range = formatImportSelectionRange(failure.importSelection, failure.selectedRange);
    if (range) details.push(`Selected range: ${range}`);
    const counts = failure.extractionCounts || {};
    if (counts.characterCount !== undefined) details.push(`Extracted characters: ${formatNumber(counts.characterCount)}`);
    if (counts.pageCount !== undefined) details.push(`Pages: ${formatNumber(counts.pageCount)}`);
    if (counts.chunkCount !== undefined) details.push(`Chunks: ${formatNumber(counts.chunkCount)}`);
    if (counts.firstTextPage) details.push(`First text page: ${formatNumber(counts.firstTextPage)}`);
    const textPages = formatTextBearingPages(counts.textBearingPages || counts.pagesWithText || []);
    if (textPages) details.push(`Pages with text: ${textPages}`);
    (Array.isArray(failure.errors) ? failure.errors : []).forEach((error) => details.push(`Error: ${formatBackendDetail(error)}`));
    (Array.isArray(failure.warnings) ? failure.warnings : []).forEach((warning) => details.push(`Warning: ${formatBackendDetail(warning)}`));
    return uniqueStrings(details);
  }

  function makePrepareReviewRecoverySuggestions(failure) {
    const suggestions = ['Retry analysis. Charlemagne will keep using the safest automatic chunking.'];
    const counts = failure.extractionCounts || {};
    const errors = [
      failure.teacherFriendlyError,
      failure.message,
      ...(Array.isArray(failure.errors) ? failure.errors : [])
    ].join(' ').toLowerCase();
    if (failure.mode === 'preview' && (Number(counts.characterCount || 0) < 500 || errors.includes('no usable preview items') || errors.includes('title'))) {
      suggestions.push('If the selected text is short or mostly a title page, try pages 2-4 or increase max preview chars.');
    }
    const firstTextPage = getFirstTextPageFromFailure(failure);
    if (failure.mode === 'preview' && firstTextPage > 1 && errors.includes('no extractable text')) {
      suggestions.push(`Page 1 has no extractable text. Try Page ${firstTextPage}, the first page with extracted text.`);
    }
    if (isModelRuntimeTimeoutPayload(failure)) {
      suggestions.push('Try a smaller preview range or lower character limit.');
    } else if (isModelRuntimeCrashPayload(failure)) {
      suggestions.push('Try a smaller preview range, lower character limit, or a lighter local model.');
    } else if (Array.isArray(failure.failedBatches) && failure.failedBatches.length) {
      suggestions.push('Try a smaller page range or lower max preview chars for the failed range.');
    }
    if (failure.rawModelResponsePath) {
      suggestions.push('The raw model response path is available in Technical details for local debugging.');
    }
    suggestions.push('Return to Upload / Start only if this was the wrong file or content name.');
    return uniqueStrings(suggestions);
  }

  function getFirstTextPageFromFailure(failure) {
    const counts = failure?.extractionCounts || {};
    const first = Number(counts.firstTextPage || state.uploadImportEstimate?.firstTextPage || 0);
    return Number.isFinite(first) && first > 0 ? Math.floor(first) : 0;
  }

  function renderPrepareReviewFailureItemDetails(failure) {
    const validationErrors = Array.isArray(failure.validationErrors) ? failure.validationErrors : [];
    const invalidItems = Array.isArray(failure.invalidItems) ? failure.invalidItems : [];
    const repairNeeded = Array.isArray(failure.repairNeeded) ? failure.repairNeeded : [];
    if (!validationErrors.length && !invalidItems.length && !repairNeeded.length) return '';
    return `
      <div class="teacher-content-backend-details" data-prepare-review-repair-details>
        <strong>Repair details</strong>
        ${validationErrors.length ? `<p>Validation errors: ${escapeHtml(validationErrors.map(formatBackendDetail).join('; '))}</p>` : ''}
        ${invalidItems.length ? `<p>Invalid items: ${escapeHtml(invalidItems.map(formatBackendDetail).join('; '))}</p>` : ''}
        ${repairNeeded.length ? `<p>Repair needed: ${escapeHtml(repairNeeded.map(formatBackendDetail).join('; '))}</p>` : ''}
      </div>
    `;
  }

  function formatImportSelectionRange(selection, fallback = '') {
    if (selection && typeof selection === 'object') {
      if (selection.pageStart || selection.pageEnd) {
        const start = selection.pageStart || selection.pageEnd;
        const end = selection.pageEnd || selection.pageStart;
        return `Pages ${start}-${end}`;
      }
      if (selection.chunkStart || selection.chunkEnd) {
        const start = selection.chunkStart || selection.chunkEnd;
        const end = selection.chunkEnd || selection.chunkStart;
        return `Chunks ${start}-${end}`;
      }
    }
    return fallback || '';
  }

  function formatBackendDetail(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
      const preferred = [
        value.message,
        value.error,
        value.reason,
        value.section && value.index !== undefined ? `${value.section}[${value.index}]` : '',
        value.field,
        value.sourceLocation
      ].filter(Boolean);
      if (preferred.length) return preferred.join(' - ');
      try {
        return JSON.stringify(value);
      } catch (_error) {
        return String(value);
      }
    }
    return String(value);
  }

  function formatFailedBatchDetail(batch) {
    if (!batch || typeof batch !== 'object') return '';
    const parts = [];
    if (batch.batchIndex) parts.push(`Affected batch: ${batch.batchIndex}`);
    if (batch.retryIndex) parts.push(`Retry chunk: ${batch.retryIndex}`);
    if (Array.isArray(batch.pages) && batch.pages.length) parts.push(`Affected page/slide: ${batch.pages.join(', ')}`);
    if (Array.isArray(batch.chunkLabels) && batch.chunkLabels.length) parts.push(`Affected source: ${batch.chunkLabels.join(', ')}`);
    if (batch.characterCount) parts.push(`Characters: ${batch.characterCount}`);
    if (Array.isArray(batch.errors) && batch.errors.length) parts.push(`Backend error JSON: ${batch.errors.map(formatBackendDetail).join(' | ')}`);
    return parts.join('; ');
  }

  function formatFailedBatchPageNotice(failedBatches) {
    const pages = Array.from(new Set((Array.isArray(failedBatches) ? failedBatches : [])
      .flatMap((batch) => Array.isArray(batch?.pages) ? batch.pages : [])
      .map(Number)
      .filter((page) => Number.isFinite(page) && page > 0))).sort((a, b) => a - b);
    if (!pages.length) return 'Some source chunks were not analyzed.';
    return `${pages.length === 1 ? 'Slide' : 'Slides'} ${formatCompactNumberRange(pages)} ${pages.length === 1 ? 'was' : 'were'} not analyzed.`;
  }

  function formatCompactNumberRange(values) {
    const unique = Array.from(new Set((Array.isArray(values) ? values : [])
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
    if (!unique.length) return '';
    const ranges = [];
    let start = unique[0];
    let previous = unique[0];
    for (let index = 1; index < unique.length; index += 1) {
      const value = unique[index];
      if (value === previous + 1) {
        previous = value;
        continue;
      }
      ranges.push(start === previous ? String(start) : `${start}-${previous}`);
      start = value;
      previous = value;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    return ranges.join(', ');
  }

  function isModelRuntimeCrashPayload(payload) {
    const text = [
      payload?.teacherFriendlyError,
      payload?.message,
      payload?.details,
      ...(Array.isArray(payload?.errors) ? payload.errors : []),
      ...(Array.isArray(payload?.technicalErrors) ? payload.technicalErrors : []),
      ...(Array.isArray(payload?.failedBatches) ? payload.failedBatches.flatMap((batch) => batch && Array.isArray(batch.errors) ? batch.errors : []) : [])
    ].map(formatBackendDetail).join(' ').toLowerCase();
    return text.includes('local gemma crashed')
      || text.includes(['oll', 'ama returned http 500'].join(''))
      || text.includes('ggml_assert')
      || text.includes('signal arrived during cgo execution')
      || text.includes('model runner has unexpectedly stopped')
      || text.includes('resource limitations');
  }

  function isModelRuntimeTimeoutPayload(payload) {
    const text = [
      payload?.teacherFriendlyError,
      payload?.message,
      payload?.details,
      ...(Array.isArray(payload?.errors) ? payload.errors : []),
      ...(Array.isArray(payload?.technicalErrors) ? payload.technicalErrors : []),
      ...(Array.isArray(payload?.failedBatches) ? payload.failedBatches.flatMap((batch) => batch && Array.isArray(batch.errors) ? batch.errors : []) : [])
    ].map(formatBackendDetail).join(' ').toLowerCase();
    return text.includes('local gemma took too long while reading this batch')
      || text.includes(['oll', 'ama request timed out'].join(''))
      || text.includes('request timed out')
      || text.includes('timeout');
  }

  function uniqueStrings(items) {
    return Array.from(new Set((Array.isArray(items) ? items : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean)));
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
          <button type="button" class="small-button secondary-small" data-handoff-tab="review">Review Draft Content</button>
        </div>
      </section>
    `;
  }

  function renderUploadCreateProgress() {
    const progress = normalizeUploadProgress();
    const ready = progress.tone === 'ready';
    const working = progress.tone === 'working';
    const error = progress.tone === 'error';
    if (!ready && !working && !error && !progress.detail) return '';
    const width = `${Math.max(0, Math.min(100, progress.percent))}%`;
    return `
      <section class="teacher-content-upload-progress ${ready ? 'ready' : ''} ${working ? 'working' : ''} ${error ? 'error' : ''}" data-upload-create-progress data-upload-progress-display aria-label="Upload progress">
        <div class="teacher-content-progress-head">
          <strong data-upload-progress-label>${escapeHtml(progress.label)}</strong>
          <span data-upload-progress-percent>${escapeHtml(formatNumber(progress.percent))}%</span>
        </div>
        <div class="teacher-content-progress-bar teacher-content-upload-progress-bar" aria-label="Upload progress bar" data-upload-progress-bar>
          <span style="width: ${escapeAttr(width)}" data-upload-progress-fill></span>
        </div>
        ${progress.detail ? `<small data-upload-progress-detail>${escapeHtml(progress.detail)}</small>` : ''}
        <span class="teacher-content-pill ${working ? 'review' : ready ? 'ready' : error ? 'blocked' : 'muted'}" data-upload-create-stage>${escapeHtml(progress.label)}</span>
      </section>
    `;
  }

  function normalizeUploadProgress() {
    const progress = state.uploadProgress || {};
    const queueSummary = summarizeUploadQueueState();
    if (state.uploadProgressError) {
      return {
        label: 'Error',
        detail: progress.detail || state.uploadProgressError.failedStep || '',
        percent: Number(progress.percent || 0),
        tone: 'error'
      };
    }
    if (state.uploadQueueRunning) {
      return {
        label: progress.label || 'Processing queue',
        detail: progress.detail || `Queue running: ${queueSummary.total} file${queueSummary.total === 1 ? '' : 's'}`,
        percent: Number(progress.percent || 25),
        tone: 'working'
      };
    }
    if (queueSummary.total > 0 && (queueSummary.ready > 0 || queueSummary.failed > 0 || queueSummary.canceled > 0)) {
      return {
        label: queueSummary.failed > 0 ? 'Completed with failures' : queueSummary.canceled > 0 ? 'Canceled remaining' : 'Queue complete',
        detail: progress.detail || buildUploadQueueSummaryMessage(queueSummary),
        percent: Number(progress.percent || 100),
        tone: queueSummary.failed > 0 ? 'error' : 'ready'
      };
    }
    if (state.uploadPrepareReviewHandoff?.packId) {
      return { label: 'Ready for review', detail: 'Almost ready', percent: 100, tone: 'ready' };
    }
    if (state.uploadPrepareReviewLoading) {
      return {
        label: progress.label || 'Generating',
        detail: progress.detail || 'This may take a moment',
        percent: Number(progress.percent || 72),
        tone: 'working'
      };
    }
    if (state.uploadCreateReviewLoading || state.uploadExtractionLoading) {
      return {
        label: progress.label || 'Uploading',
        detail: progress.detail || 'Reading file',
        percent: Number(progress.percent || 15),
        tone: 'working'
      };
    }
    if (state.uploadAutoImportPlan || state.uploadImportEstimate) {
      return {
        label: progress.label || 'Ready to generate draft',
        detail: progress.detail || getPlannedBatchDetail(state.uploadAutoImportPlan || state.uploadImportEstimate),
        percent: Number(progress.percent || 60),
        tone: 'ready'
      };
    }
    return {
      label: progress.label || 'Ready',
      detail: progress.detail || '',
      percent: Number(progress.percent || 0),
      tone: progress.tone || 'idle'
    };
  }

  function renderUploadProgressErrorPanel() {
    const error = state.uploadProgressError;
    if (!error) return '';
    return `
      <section class="teacher-content-progress-error-panel" data-upload-progress-error-panel>
        <h5>${escapeHtml(error.title || 'Import needs attention')}</h5>
        <p data-upload-progress-error-failed>${escapeHtml(error.failedStep || 'Import failed')}</p>
        <p data-upload-progress-error-detail>${escapeHtml(error.detail || 'Something went wrong.')}</p>
        ${error.failedBatchNotice && error.failedBatchNotice !== 'Some source chunks were not analyzed.' ? `<p data-upload-progress-failed-pages>${escapeHtml(error.failedBatchNotice)}</p>` : ''}
        ${Array.isArray(error.backendDetails) && error.backendDetails.length ? `
          <details class="teacher-content-backend-details" data-upload-progress-error-backend-details>
            <summary>Technical details</summary>
            <ul>${error.backendDetails.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>
          </details>
        ` : ''}
        ${Array.isArray(error.suggestions) && error.suggestions.length ? `
          <div class="teacher-content-backend-details" data-upload-progress-error-suggestions>
            <strong>Try this</strong>
            <ul>${error.suggestions.map((suggestion) => `<li>${escapeHtml(suggestion)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </section>
    `;
  }

  function getPlannedBatchDetail(planOrEstimate) {
    const count = Number(planOrEstimate?.batchCount || planOrEstimate?.estimatedGemmaBatches || 0);
    if (Number.isFinite(count) && count > 0) return `${formatNumber(count)} batches planned`;
    return '';
  }

  function getGenerateProgressDetail(importMode) {
    const count = Number(state.uploadAutoImportPlan?.batchCount || state.uploadImportEstimate?.estimatedGemmaBatches || 0);
    if (Number.isFinite(count) && count > 0) return `${formatNumber(count)} batches planned`;
    if (importMode === 'full') return 'This may take a moment';
    if (importMode === 'selected') return 'Selected range';
    return 'Running analysis';
  }

  function renderImportActivityPanel() {
    const timeline = Array.isArray(state.uploadCreateReviewTimeline) ? state.uploadCreateReviewTimeline : [];
    const hasActivity = timeline.length > 0 || state.uploadCreateReviewLoading || state.uploadCreateReviewError || state.uploadPrepareReviewHandoff?.packId || state.uploadPrepareReviewLastFailure;
    if (!hasActivity) return '';
    const entries = timeline.length ? timeline : makeStagedImportTimeline('Ready to create review draft');
    const blocked = Boolean(state.uploadCreateReviewError || state.uploadPrepareReviewLastFailure);
    return `
      <section class="teacher-content-import-activity" data-import-activity-panel aria-label="Analysis Activity">
        <div class="teacher-content-card-head">
          <div>
            <h5>Analysis Activity</h5>
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
    if (details.previewMode) parts.push(`Preview mode: ${details.previewMode}`);
    if (details.maxPreviewChars !== undefined) parts.push(`Max preview chars: ${formatNumber(details.maxPreviewChars)}`);
    if (details.pageRange) parts.push(`Selected pages: ${details.pageRange}`);
    if (details.chunkRange) parts.push(`Selected chunks: ${details.chunkRange}`);
    if (details.batchIndex && details.totalBatches) parts.push(`Batch ${details.batchIndex} of ${details.totalBatches}`);
    if (details.retryIndex && details.retryTotal) parts.push(`Retry ${details.retryIndex} of ${details.retryTotal}`);
    if (details.retryMaxCharacters) parts.push(`Retry limit: ${formatNumber(details.retryMaxCharacters)} chars`);
    if (details.invalidItemCount !== undefined) parts.push(`Quarantined items: ${formatNumber(details.invalidItemCount)}`);
    if (details.repairNeededCount !== undefined) parts.push(`Repair-needed items: ${formatNumber(details.repairNeededCount)}`);
    const normalization = details.importNormalization && typeof details.importNormalization === 'object' ? details.importNormalization : null;
    if (normalization) {
      if (normalization.conceptIdsGenerated) parts.push(`Normalized concept IDs: ${formatNumber(normalization.conceptIdsGenerated)}`);
      if (normalization.conceptTitlesGenerated) parts.push(`Normalized concept titles: ${formatNumber(normalization.conceptTitlesGenerated)}`);
      if (normalization.reviewNeededItems) parts.push(`Review-needed items: ${formatNumber(normalization.reviewNeededItems)}`);
      if (normalization.droppedItems) parts.push(`Dropped items: ${formatNumber(normalization.droppedItems)}`);
    }
    if (details.validationPassed !== undefined) parts.push(`Validation: ${details.validationPassed ? 'passed' : 'failed'}`);
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
    const estimate = state.uploadImportEstimate || {};
    const plan = state.uploadAutoImportPlan || {};
    const metadata = result.metadata || extraction.metadata || {};
    const unitCount = estimate.pageCount || metadata.pageCount || metadata.slideCount || metadata.sheetCount || result.pageCount || extraction.pageCount || 0;
    const textBearing = getTextBearingPages();
    const firstTextBearing = plan.extractionSummary?.firstTextBearingPageSlideSheet || estimate.firstTextPage || metadata.firstTextPage || metadata.firstTextSlide || textBearing[0] || '';
    return `
      <section class="teacher-content-upload-summary" data-upload-source-summary>
        <div class="teacher-content-metric-grid">
          ${metric('Original filename', result.originalFileName || state.selectedUploadFile?.name || 'Not selected', 'data-upload-summary-original-filename')}
          ${metric('File type', result.fileType || extraction.detectedType || metadata.detectedType || 'Unknown', 'data-upload-summary-file-type')}
          ${metric('Pages/slides/sheets found', formatNumber(unitCount), 'data-upload-summary-unit-count')}
          ${metric('Text-bearing pages/slides/sheets', formatNumber(plan.extractionSummary?.textBearingPageSlideSheetCount || textBearing.length || metadata.textBearingPages?.length || 0), 'data-upload-summary-text-bearing-count')}
          ${metric('First text-bearing page/slide/sheet', firstTextBearing ? formatNumber(firstTextBearing) : 'None found', 'data-upload-summary-first-text-bearing')}
          ${metric('Estimated batches', formatNumber(plan.batchCount || estimate.estimatedGemmaBatches), 'data-upload-summary-estimated-batches')}
          ${metric('Planner reason', plan.reason || state.uploadPrepareReviewMessage || 'Planner recommendation will appear after analysis.', 'data-upload-summary-planner-reason')}
          ${metric('Extraction status', extraction.success === false ? 'Failed' : 'Extracted')}
          ${metric('Character count', formatNumber(result.characterCount ?? extraction.characterCount ?? metadata.characterCount))}
        </div>
      </section>
    `;
  }

  function renderAdvancedUploadDetails(result, extraction, includeWrapper = true) {
    const plannerWarnings = Array.from(new Set([
      ...(Array.isArray(state.uploadAutoImportPlan?.warnings) ? state.uploadAutoImportPlan.warnings : []),
      ...(Array.isArray(result.warnings) ? result.warnings : []),
      ...(Array.isArray(extraction.warnings) ? extraction.warnings : [])
    ]));
    const hasDetails = Boolean(
      result.originalFileName
      || state.selectedUploadFile?.name
      || result.fileType
      || extraction.detectedType
      || result.characterCount
      || extraction.characterCount
      || plannerWarnings.length
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
        ${renderIssueList('Planner warnings', plannerWarnings)}
        ${renderIssueList('Errors', result.errors || extraction.errors)}
    `;
    if (!includeWrapper) return details;
    return `
      <details class="teacher-content-advanced-details" data-upload-technical-summary>
        <summary>Technical details</summary>
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
    const importScope = getDraftImportScope(draft);
    return `
      <section class="teacher-content-selected-draft" data-selected-draft-summary>
        <div>
          <span>Selected draft pack</span>
          <strong data-selected-draft-title>${escapeHtml(draft.title || 'Untitled draft pack')}</strong>
          <small data-selected-draft-pack-id>${escapeHtml(draft.packId || state.selectedDraftPackId || 'No pack ID')}</small>
        </div>
        <div class="teacher-content-selected-draft-meta">
          <span data-selected-draft-import-scope>${escapeHtml(formatImportScopeLabel(importScope))}</span>
          <span data-selected-draft-pending>Pending review: ${formatNumber(summary.pending)}</span>
          <span data-selected-draft-validation>Validation: ${escapeHtml(passFail(draft.validationPassed))}</span>
        </div>
      </section>
      ${renderImportScopeWarning(importScope, 'draft')}
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

  function getTotalPrimaryDraftItemCount(draft) {
    const counts = draft?.itemCounts && typeof draft.itemCounts === 'object' ? draft.itemCounts : {};
    const fromCounts = REVIEW_PRIMARY_DRAFT_SECTIONS.reduce((total, sectionName) => {
      return total + Number(counts[sectionName] || 0);
    }, 0);
    if (fromCounts > 0) return fromCounts;
    const packet = state.report?.draftPacketItems || {};
    return REVIEW_PRIMARY_DRAFT_SECTIONS.reduce((total, sectionName) => {
      const rows = Array.isArray(packet[sectionName]) ? packet[sectionName] : [];
      return total + rows.length;
    }, 0);
  }

  function getReviewItemGroups() {
    const reviewGroups = state.report?.reviewItems?.items;
    if (hasGroupRows(reviewGroups)) return reviewGroups;
    const pendingGroups = state.report?.pendingReview?.items;
    if (hasGroupRows(pendingGroups)) return pendingGroups;
    return buildFallbackReviewGroupsFromDraftPacket(state.report?.draftPacketItems || {});
  }

  function hasGroupRows(groups) {
    if (!groups || typeof groups !== 'object') return false;
    return REVIEW_GROUP_ORDER.some((sectionName) => Array.isArray(groups[sectionName]) && groups[sectionName].length > 0);
  }

  function buildFallbackReviewGroupsFromDraftPacket(packet = {}) {
    const groups = {};
    REVIEW_GROUP_ORDER.forEach((sectionName) => {
      groups[sectionName] = [];
    });
    REVIEW_PRIMARY_DRAFT_SECTIONS.forEach((sectionName) => {
      const items = Array.isArray(packet?.[sectionName]) ? packet[sectionName] : [];
      groups[sectionName] = items.map((item, index) => makeFallbackReviewRow(sectionName, item, index));
    });
    return groups;
  }

  function makeFallbackReviewRow(section, item, index) {
    const safeItem = item && typeof item === 'object' ? item : {};
    return {
      section,
      index,
      itemId: safeItem.itemId || safeItem.term || safeItem.conceptId || safeItem.formulaId || `${section}-${index}`,
      label: safeItem.term || safeItem.title || safeItem.equation || safeItem.conceptId || safeItem.formulaId || 'Draft item',
      reviewStatus: safeItem.reviewStatus || 'pending',
      confidence: safeItem.confidence || '',
      title: safeItem.title || safeItem.term || safeItem.equation || '',
      term: safeItem.term || '',
      question: safeItem.question || '',
      equation: safeItem.equation || '',
      standardId: safeItem.standardId || '',
      draftWording: safeItem.studentDefinition || safeItem.studentExplanation || safeItem.equation || safeItem.description || '',
      sourceFile: safeItem.sourceFile || '',
      sourceLocation: safeItem.sourceLocation || '',
      sourceTextSnippet: safeItem.sourceTextSnippet || '',
      standards: Array.isArray(safeItem.standards) ? safeItem.standards : [],
      standardsStatusLabel: '',
      validationStatus: safeItem.validationStatus || '',
      repairStatus: safeItem.repairStatus || '',
      quarantineStatus: safeItem.quarantineStatus || '',
      warningStatus: safeItem.warningStatus || '',
      extractionStatus: safeItem.extractionStatus || '',
      modelStatus: safeItem.modelStatus || '',
      solverStatus: safeItem.solverStatus || '',
      validationErrors: Array.isArray(safeItem.validationErrors) ? safeItem.validationErrors : [],
      warnings: Array.isArray(safeItem.warnings) ? safeItem.warnings : [],
      sourceGrounding: safeItem.sourceGrounding && typeof safeItem.sourceGrounding === 'object' && !Array.isArray(safeItem.sourceGrounding)
        ? safeItem.sourceGrounding
        : null,
      editableFields: {}
    };
  }

  function hasAnyPrimaryDraftItems() {
    const packet = state.report?.draftPacketItems || {};
    if (REVIEW_PRIMARY_DRAFT_SECTIONS.some((sectionName) => Array.isArray(packet[sectionName]) && packet[sectionName].length > 0)) {
      return true;
    }
    const reviewGroups = state.report?.reviewItems?.items;
    if (reviewGroups && typeof reviewGroups === 'object') {
      return REVIEW_PRIMARY_DRAFT_SECTIONS.some((sectionName) => Array.isArray(reviewGroups[sectionName]) && reviewGroups[sectionName].length > 0);
    }
    return false;
  }

  function getReviewSectionCount(groups, draft) {
    const coverage = state.report?.coverageReport || draft?.metadata?.importCoverage || {};
    const processedChunks = Number(coverage.processedChunks || 0);
    if (processedChunks > 0) return processedChunks;
    const totalChunks = Number(coverage.totalChunks || 0);
    if (totalChunks > 0) return totalChunks;
    const countSource = draft?.itemCounts && typeof draft.itemCounts === 'object'
      ? draft.itemCounts
      : state.report?.coverageReport?.itemCounts && typeof state.report.coverageReport.itemCounts === 'object'
        ? state.report.coverageReport.itemCounts
        : null;
    if (countSource) {
      const counted = REVIEW_COUNTED_SECTIONS.filter((sectionName) => sectionName in countSource);
      if (counted.length) return counted.length;
    }
    return REVIEW_COUNTED_SECTIONS.filter((sectionName) => Array.isArray(groups?.[sectionName]) && groups[sectionName].length > 0).length;
  }

  function clearStaleReviewCanceledMessage() {
    if (typeof state.reviewBulkMessage !== 'string') return;
    if (/^Review canceled\b/i.test(state.reviewBulkMessage.trim())) {
      state.reviewBulkMessage = '';
    }
  }

  function clearDraftScopedReviewUiState() {
    state.selectedReviewItem = null;
    state.selectedReviewEvidenceItem = null;
    state.selectedReviewItemKeys = [];
    state.reviewListFilter = 'all';
    state.reviewNeedsReviewExpanded = false;
    state.reviewCompleted = false;
    state.reviewBulkMessage = '';
    state.promotionMessage = '';
  }

  function canCreateApprovedPackFromCurrentReport(summary) {
    const readiness = state.report?.promotionReadiness || {};
    return summary.pending === 0 && summary.approved > 0 && readiness.ready === true;
  }

  function getDraftImportScope(draft) {
    return draft?.importScope || state.report?.draftPack?.importScope || {};
  }

  function formatImportScopeLabel(scope = {}) {
    const label = scope.scopeLabel || (scope.scope === 'preview_sample' ? 'Preview Sample' : scope.scope === 'selected_range' ? 'Selected Range' : 'Full Import');
    const range = scope.rangeLabel || (scope.pageRangeLabel ? `Pages ${scope.pageRangeLabel}` : scope.chunkRangeLabel ? `Chunks ${scope.chunkRangeLabel}` : '');
    return [label, range].filter(Boolean).join(' - ');
  }

  function renderImportScopeWarning(scope = {}, context = 'draft') {
    if (!scope || (!scope.sampleOnly && !scope.rangeLimited)) return '';
    const message = scope.warning || (scope.sampleOnly
      ? `This draft only covers ${scope.rangeLabel || 'the preview range'}. Run Full Import to process the whole document.`
      : `This draft covers only ${scope.rangeLabel || 'a selected range'}.`);
    const action = scope.sampleOnly
      ? 'Run Full Document Import before approving this as your main pack.'
      : 'Approve only if this selected range is the intended pack scope.';
    return `
      <section class="teacher-content-scope-warning ${scope.sampleOnly ? 'sample' : 'range'}" data-import-scope-warning data-${escapeAttr(context)}-scope-warning>
        <strong>${escapeHtml(scope.sampleOnly ? 'Sample draft' : 'Range-limited draft')}</strong>
        <p>${escapeHtml(message)} ${escapeHtml(action)}</p>
      </section>
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
    const summary = coverage.coverageSummary || {};
    return `
      <section class="teacher-content-counts" data-import-coverage-report>
        <h5>Coverage report</h5>
        <div class="teacher-content-count-strip">
          ${countPill('Total pages', coverage.totalPages, 'data-import-coverage-total-pages')}
          ${countPill('Total chunks', coverage.totalChunks, 'data-import-coverage-total-chunks')}
          ${countPill('Processed chunks', coverage.processedChunks, 'data-import-coverage-processed-chunks')}
          ${countPill('Chunks with items', coverage.chunksWithDraftItems, 'data-import-coverage-chunks-with-items')}
          ${countPill('Chunks without items', coverage.chunksWithNoExtractedKnowledge, 'data-import-coverage-empty-chunks')}
          ${countPill('Queued chunks', summary.queuedChunks, 'data-import-coverage-queued-chunks')}
          ${countPill('Drafted chunks', summary.draftedChunks, 'data-import-coverage-drafted-chunks')}
          ${countPill('Skipped empty', summary.skippedEmptyChunks, 'data-import-coverage-skipped-empty-chunks')}
          ${countPill('No items found', summary.noItemsFoundChunks, 'data-import-coverage-no-items-found-chunks')}
          ${countPill('Needs review', summary.needsReviewChunks, 'data-import-coverage-needs-review-chunks')}
          ${countPill('Failed chunks', summary.failedChunks, 'data-import-coverage-failed-chunks')}
          ${countPill('Total source chars', summary.totalSourceChars, 'data-import-coverage-total-source-chars')}
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

  function focusKnowledgeManager() {
    closeOverlay();
    window.Charlemagne?.blades?.open?.('ai-improvement', { sound: false });
    const manager = byId('teacherContentKnowledgeManager');
    if (!manager) return;
    manager.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const preferredFocus = manager.querySelector('[data-approved-pack-view-edit-action]') || manager.querySelector('[data-draft-pack-view-edit-action]');
    preferredFocus?.focus();
    setStatus('Viewing saved knowledge packs.');
  }

  function openDraftPackForReview(packId) {
    if (!packId) return;
    state.selectedDraftPackId = packId;
    clearDraftScopedReviewUiState();
    state.activeTab = 'review';
    openOverlay().then(async () => {
      if (state.loadedOnce) {
        await loadSelectedDraftReport();
      }
      render();
    });
  }

  function firstError(errors, fallback) {
    return Array.isArray(errors) && errors.length ? String(errors[0]) : fallback;
  }

  async function moveToNextDraftNeedingReview(currentPackId = '') {
    const queuePacks = buildReviewQueuePacks()
      .filter((pack) => pack.packId)
      .filter((pack) => ['needs review', 'partially reviewed'].includes(String(pack.statusLabel || '').toLowerCase()));
    if (!queuePacks.length) return false;
    const currentIndex = queuePacks.findIndex((pack) => pack.packId === currentPackId);
    const start = currentIndex >= 0 ? currentIndex + 1 : 0;
    const ordered = [...queuePacks.slice(start), ...queuePacks.slice(0, start)];
    const next = ordered.find((pack) => pack.packId !== currentPackId);
    if (!next) return false;
    state.selectedDraftPackId = next.packId;
    clearDraftScopedReviewUiState();
    await loadSelectedDraftReport();
    state.activeTab = 'review';
    return true;
  }

  function normalizeImportProfileSelection(value) {
    const normalized = String(value || '').trim();
    return IMPORT_PROFILES.some((profile) => profile.value === normalized) ? normalized : '';
  }

  function normalizeImportProfileForPayload(value) {
    const normalized = normalizeImportProfileSelection(value);
    return normalized || 'general';
  }

  function renderImportProfileOptions() {
    return IMPORT_PROFILES.map((profile) => `
      <option value="${escapeAttr(profile.value)}" ${state.uploadImportProfile === profile.value ? 'selected' : ''}>${escapeHtml(profile.label)}</option>
    `).join('');
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

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  function buildDefaultPackNameFromFile(file, fallbackFileName = '') {
    const relativePath = String(file?.webkitRelativePath || file?.relativePath || '').trim();
    const fileName = String(file?.name || fallbackFileName || '').trim();
    const cleanFileName = makeContentNameFromFileName(fileName || relativePath);
    if (!relativePath) return cleanFileName;
    const parentFolderName = extractNearestMeaningfulParentFolder(relativePath);
    if (!parentFolderName) return cleanFileName;
    return `${parentFolderName} - ${cleanFileName}`;
  }

  function extractNearestMeaningfulParentFolder(relativePath) {
    const normalized = String(relativePath || '')
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (!normalized) return '';
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    const parentFolder = parts[parts.length - 2];
    return makeContentNameFromFileName(parentFolder);
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
