(() => {
  const teacherContent = window.CharlemagneTeacherContent || {};
  const constants = teacherContent.constants || {};
  const ENDPOINTS = constants.ENDPOINTS || {};
  const TABS = constants.TABS || [];
  const SECTION_LABELS = constants.SECTION_LABELS || {};
  const REVIEW_GROUP_ORDER = constants.REVIEW_GROUP_ORDER || [];
  const REVIEW_COUNTED_SECTIONS = constants.REVIEW_COUNTED_SECTIONS || [];
  const REVIEW_PRIMARY_DRAFT_SECTIONS = constants.REVIEW_PRIMARY_DRAFT_SECTIONS || [];
  const IMPORT_PROFILES = constants.IMPORT_PROFILES || [];
  const EDITABLE_FIELDS = constants.EDITABLE_FIELDS || {};
  const IMPORT_ACTIVITY_MESSAGES = constants.IMPORT_ACTIVITY_MESSAGES || {};
  const PAUSED_STANDARDS_WARNING_PATTERNS = constants.PAUSED_STANDARDS_WARNING_PATTERNS || [];

  const state = typeof teacherContent.createInitialState === 'function'
    ? teacherContent.createInitialState()
    : {};

  const utils = teacherContent.utils || {};
  const byId = utils.byId || ((id) => document.getElementById(id));
  const escapeHtml = utils.escapeHtml || ((value) => String(value ?? ''));
  const escapeAttr = utils.escapeAttr || ((value) => escapeHtml(value));
  const cssEscape = utils.cssEscape || ((value) => String(value || ''));
  const unwrap = utils.unwrap || ((payload) => (payload && payload.success === true && payload.data ? payload.data : payload));

  const api = teacherContent.api || {};
  const fetchJson = api.fetchJson || ((url, options) => window.Charlemagne.api.fetchJson(url, options));

  let overlayController = {};
  let tabsController = {};
  let statusController = {};
  let standardsPanelController = {};
  let uploadController = {};
  let reviewController = {};
  let approvedController = {};

  function appendReviewDebugEvent(eventName, details = {}) {
    const entry = {
      event: String(eventName || 'unknown'),
      at: new Date().toISOString(),
      details
    };
    state.reviewDebugEvents = [entry, ...(Array.isArray(state.reviewDebugEvents) ? state.reviewDebugEvents : [])].slice(0, 30);
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[TeacherContentReviewDebug]', entry);
    }
    return entry;
  }

  const renderUploadModule = typeof teacherContent.createRenderUploadModule === 'function'
    ? teacherContent.createRenderUploadModule({
      state,
      escapeHtml,
      escapeAttr,
      formatNumber
    })
    : {};
  const {
    formatSelectedUploadLabel: formatSelectedUploadLabelFromModule = () => 'No file selected',
    renderUploadQueueStatusLabel: renderUploadQueueStatusLabelFromModule = () => 'Waiting',
    renderUploadQueueList: renderUploadQueueListFromModule = () => ''
  } = renderUploadModule;

  const renderReviewModule = typeof teacherContent.createRenderReviewModule === 'function'
    ? teacherContent.createRenderReviewModule({
      state,
      escapeHtml,
      escapeAttr,
      formatNumber,
      SECTION_LABELS,
      REVIEW_PRIMARY_DRAFT_SECTIONS,
      EDITABLE_FIELDS,
      PAUSED_STANDARDS_WARNING_PATTERNS,
      render,
      setStatus,
      getReviewStateSnapshot,
      getReviewQueuePackIds,
      getSelectedDraftSummary,
      getReviewProgressSummary,
      getTotalPrimaryDraftItemCount,
      getActiveFixReviewItem,
      renderIssueList,
      isDraftPackApproved,
      canCreateApprovedPackFromCurrentReport,
      buildTeacherFriendlyFailedSections,
      countFailedAfterRetrySections,
      hasAnyPrimaryDraftItems,
      cardWithEmptyState,
      getVisibleReviewItems,
      reviewItemKeyForItem,
      isReviewItemReadyForPack,
      formatReviewItemStatusLabel,
      summarizeReviewItemActionNeeded,
      getReviewInlineMessage,
      getItemReviewWorkflowStatus,
      getReviewItemPromotionBlockers,
      renderReviewItemIdentityDataAttrs,
      getReviewItemPrimaryLabel,
      getDraftTitleForPackId,
      renderCoverageReport,
      metric,
      getReviewIssueBlockersForItem,
      titleCase,
      formatConfidence,
      findPendingItemByKey,
      selectedReviewItemsHaveBlockers,
      isReviewItemSelectableForAcceptSelected,
      getAcceptSelectedBlockersForItem,
      hasMissingRequiredReviewFields,
      isItemNeedingTeacherReview
    })
    : {};
  const {
    renderReviewCard: renderReviewCardFromModule = () => '',
    renderReviewEmptyQueueActionBar: renderReviewEmptyQueueActionBarFromModule = () => '',
    renderReviewDoneCard: renderReviewDoneCardFromModule = () => '',
    renderReviewSummaryLine: renderReviewSummaryLineFromModule = () => '',
    renderBulkReviewSummary: renderBulkReviewSummaryFromModule = () => '',
    renderReviewQueueList: renderReviewQueueListFromModule = () => '',
    buildReviewQueuePacks: buildReviewQueuePacksFromModule = () => [],
    isCurrentSelectedDraftAccepted: isCurrentSelectedDraftAcceptedFromModule = () => false,
    areAllReviewQueuePacksAccepted: areAllReviewQueuePacksAcceptedFromModule = () => false,
    summarizeDraftReviewCounts: summarizeDraftReviewCountsFromModule = () => ({ pending: 0, approved: 0, rejected: 0 }),
    getDraftItemCount: getDraftItemCountFromModule = () => 0,
    renderReviewFilters: renderReviewFiltersFromModule = () => '',
    renderReviewNeedsReviewSummary: renderReviewNeedsReviewSummaryFromModule = () => '',
    renderReviewTable: renderReviewTableFromModule = () => '',
    renderReviewTableRow: renderReviewTableRowFromModule = () => '',
    renderReviewAdvancedDetails: renderReviewAdvancedDetailsFromModule = () => '',
    isPausedStandardsWarning: isPausedStandardsWarningFromModule = () => false,
    getFilteredReviewItems: getFilteredReviewItemsFromModule = (items) => (Array.isArray(items) ? items : []),
    isReviewFilterMatch: isReviewFilterMatchFromModule = () => true,
    setReviewListFilter: setReviewListFilterFromModule = () => {},
    setReviewSort: setReviewSortFromModule = () => {},
    getSortedReviewItems: getSortedReviewItemsFromModule = (items) => (Array.isArray(items) ? items : []),
    getReviewSortValue: getReviewSortValueFromModule = () => '',
    renderReviewSortControl: renderReviewSortControlFromModule = () => '',
    formatReviewItemSource: formatReviewItemSourceFromModule = () => '',
    shortenReviewPreview: shortenReviewPreviewFromModule = () => '',
    renderReviewActionBar: renderReviewActionBarFromModule = () => '',
    getDraftItemWording: getDraftItemWordingFromModule = () => '',
    renderFocusedReviewItemFix: renderFocusedReviewItemFixFromModule = () => '',
    renderReviewIssuesToFix: renderReviewIssuesToFixFromModule = () => '',
    renderReviewEvidencePanel: renderReviewEvidencePanelFromModule = () => '',
    renderEditableField: renderEditableFieldFromModule = () => '',
    getReviewEditableFieldValue: getReviewEditableFieldValueFromModule = () => '',
    formatEditableFieldValue: formatEditableFieldValueFromModule = () => ''
  } = renderReviewModule;

  const renderApprovedModule = typeof teacherContent.createRenderApprovedModule === 'function'
    ? teacherContent.createRenderApprovedModule({
      state,
      byId,
      escapeHtml,
      escapeAttr,
      formatNumber,
      formatDate,
      render,
      setStatus,
      fetchJson,
      ENDPOINTS,
      unwrap,
      getVisibleDraftPacks,
      openDraftPackForReview,
      openOverlay,
      refreshTeacherContentSummaries,
      collectApiIssues,
      renderChipList,
      countPill,
      SECTION_LABELS,
      EDITABLE_FIELDS,
      window
    })
    : {};
  const {
    renderKnowledgeManager: renderKnowledgeManagerFromModule = () => {},
    renderSimpleKnowledgePackRows: renderSimpleKnowledgePackRowsFromModule = () => '',
    getVisibleKnowledgePackRows: getVisibleKnowledgePackRowsFromModule = () => [],
    renderApprovedPacksCard: renderApprovedPacksCardFromModule = () => '',
    renderApprovedBulkActions: renderApprovedBulkActionsFromModule = () => '',
    renderDraftPacksCard: renderDraftPacksCardFromModule = () => '',
    renderDraftPack: renderDraftPackFromModule = () => '',
    renderApprovedPack: renderApprovedPackFromModule = () => '',
    renderUploadedSourcesHistory: renderUploadedSourcesHistoryFromModule = () => '',
    renderUploadedSourceHistoryItem: renderUploadedSourceHistoryItemFromModule = () => '',
    renderApprovedSearchableSummary: renderApprovedSearchableSummaryFromModule = () => '',
    toggleApprovedPackActivation: toggleApprovedPackActivationFromModule = async () => {},
    deleteApprovedPack: deleteApprovedPackFromModule = async () => {},
    toggleApprovedPackSelection: toggleApprovedPackSelectionFromModule = () => {},
    toggleApprovedPackSelectAll: toggleApprovedPackSelectAllFromModule = () => {},
    deleteApprovedPacksById: deleteApprovedPacksByIdFromModule = async () => {},
    deleteSelectedApprovedPacks: deleteSelectedApprovedPacksFromModule = async () => {},
    deleteAllApprovedPacks: deleteAllApprovedPacksFromModule = async () => {},
    toggleApprovedPackDetails: toggleApprovedPackDetailsFromModule = () => {},
    closeApprovedPackEditor: closeApprovedPackEditorFromModule = () => {},
    saveApprovedPackItem: saveApprovedPackItemFromModule = async () => {},
    applyApprovedSummary: applyApprovedSummaryFromModule = () => {},
    pruneSelectedApprovedPackIds: pruneSelectedApprovedPackIdsFromModule = () => {}
  } = renderApprovedModule;

  const reviewActionsModule = typeof teacherContent.createReviewActionsModule === 'function'
    ? teacherContent.createReviewActionsModule({
      state,
      render,
      setStatus,
      fetchJson,
      ENDPOINTS,
      unwrap,
      SECTION_LABELS,
      getFilteredReviewItems,
      getVisibleReviewItems,
      getVisibleReviewItemsForPack,
      reviewItemKeyForItem,
      reviewItemKey,
      isReviewItemReadyForPack,
      isReviewItemSelectableForAcceptSelected,
      getSelectedReviewItems,
      isReviewItemBlockingPromotion,
      getPromotionBlockingReviewItems,
      getAcceptSelectedBlockersForItem,
      getPromotableApprovedReviewItemCount,
      formatNumber,
      buildReviewItemRef,
      formatEditableFieldValue,
      getItemReviewWorkflowStatus,
      getReviewEditableFieldValue,
      getReviewItemPromotionBlockers,
      makePostEditSaveMessage,
      clearDraftScopedReviewUiState,
      loadSelectedDraftReport,
      refreshReviewQueueReports,
      getReviewQueuePackIds,
      findReviewItemFromButton,
      isReviewFilterMatch,
      makeActiveFixItem,
      buildReviewItemRefFromButton,
      scrollFocusedFixViewIntoView,
      findPendingItemByKey,
      refreshDraftLists,
      reconcileSelectedReviewItem,
      openReviewEvidence,
      closeReviewEvidence,
      findReviewItem,
      getActiveFixReviewItem,
      appendReviewDebugEvent,
      approveSelectedReviewItemWithCurrentEdits,
      getReviewItemPrimaryLabel,
      refreshSelectedDraftReportFromBackend,
      setReviewInlineMessage,
      isReviewConflictError,
      refreshFocusedReviewItemAfterConflict,
      refreshFocusedReviewItemState,
      formatReviewBlockerSummary,
      applyApprovedSummary,
      refreshTeacherContentSummaries,
      focusKnowledgeManager,
      buildReviewQueuePacks,
      window
    })
    : {};
  const {
    toggleSelectAllVisibleReviewItems: toggleSelectAllVisibleReviewItemsFromModule = () => {},
    clearReviewSelection: clearReviewSelectionFromModule = () => {},
    openReviewItem: openReviewItemFromModule = async () => {},
    openReviewItemEditorFromButton: openReviewItemEditorFromButtonFromModule = async () => {},
    openFocusedReviewItemFixFromButton: openFocusedReviewItemFixFromButtonFromModule = async () => {},
    updateReviewSelection: updateReviewSelectionFromModule = () => {},
    acceptSelectedReviewItems: acceptSelectedReviewItemsFromModule = async () => {},
    explainDisabledAcceptSelected: explainDisabledAcceptSelectedFromModule = () => {},
    excludeSelectedFlaggedReviewItems: excludeSelectedFlaggedReviewItemsFromModule = async () => {},
    excludeSelectedReviewItems: excludeSelectedReviewItemsFromModule = async () => {},
    acceptAllReviewItems: acceptAllReviewItemsFromModule = async () => {},
    acceptReviewItems: acceptReviewItemsFromModule = async () => {},
    requestCombinedReviewApproval: requestCombinedReviewApprovalFromModule = async () => ({ success: false, errors: ['Not available'], skipped: null, data: null }),
    resolveCombinedReviewBatchName: resolveCombinedReviewBatchNameFromModule = () => '',
    closeReviewItem: closeReviewItemFromModule = () => {},
    openReviewEvidence: openReviewEvidenceFromModule = () => {},
    closeReviewEvidence: closeReviewEvidenceFromModule = () => {},
    updateReviewStatusFromButton: updateReviewStatusFromButtonFromModule = async () => {},
    patchReviewStatus: patchReviewStatusFromModule = async () => false,
    saveFocusedReviewItemEditsFromButton: saveFocusedReviewItemEditsFromButtonFromModule = async () => {},
    approveSelectedReviewItemWithCurrentEdits: approveSelectedReviewItemWithCurrentEditsFromModule = async () => {},
    collectReviewFieldEdits: collectReviewFieldEditsFromModule = () => [],
    mutateReviewDraft: mutateReviewDraftFromModule = async () => false
  } = reviewActionsModule;

  const uploadQueueModule = typeof teacherContent.createUploadQueueModule === 'function'
    ? teacherContent.createUploadQueueModule({
      state,
      makeContentNameFromFileName,
      buildDefaultPackNameFromFile,
      normalizeImportProfileForPayload,
      appendImportActivity,
      setUploadProgress,
      render,
      setStatus,
      fetchJson,
      ENDPOINTS,
      unwrap,
      applyImportTimeline
    })
    : {};
  const {
    buildUploadQueueFromFiles: buildUploadQueueFromFilesFromModule = () => [],
    makeQueuePackNamesCollisionSafe: makeQueuePackNamesCollisionSafeFromModule = (queue) => queue,
    updateUploadQueueItem: updateUploadQueueItemFromModule = () => null,
    markWaitingQueueItemsCanceled: markWaitingQueueItemsCanceledFromModule = () => {},
    summarizeUploadQueueState: summarizeUploadQueueStateFromModule = () => ({ ready: 0, failed: 0, canceled: 0, total: 0 }),
    buildUploadQueueSummaryMessage: buildUploadQueueSummaryMessageFromModule = () => 'No files were processed.',
    processUploadQueueItem: processUploadQueueItemFromModule = async () => {},
    cancelRemainingUploadQueue: cancelRemainingUploadQueueFromModule = () => {}
  } = uploadQueueModule;

  function buildOverlay(...args) {
    return overlayController.buildOverlay?.(...args);
  }

  overlayController = typeof teacherContent.createOverlayModule === 'function'
    ? teacherContent.createOverlayModule({
      state,
      byId,
      render,
      loadTeacherContent
    })
    : {};

  tabsController = typeof teacherContent.createTabsModule === 'function'
    ? teacherContent.createTabsModule({
      state,
      TABS,
      byId,
      escapeHtml,
      escapeAttr,
      renderCard,
      render,
      canOpenDoneTab,
      setStatus,
      clearStaleReviewCanceledMessage,
      isCurrentSelectedDraftAccepted,
      areAllReviewQueuePacksAccepted,
      getReviewStateSnapshot,
      summarizeUploadQueueState,
      getReviewProgressSummary,
      getSelectedDraftSummary
    })
    : {};

  statusController = typeof teacherContent.createStatusModule === 'function'
    ? teacherContent.createStatusModule({
      state,
      byId,
      formatNumber,
      uniqueStrings,
      formatFailedBatchDetail,
      formatBackendDetail,
      formatFailedBatchPageNotice,
      isTeacherContentAnalysisFailurePayload
    })
    : {};

  standardsPanelController = typeof teacherContent.createStandardsPanelModule === 'function'
    ? teacherContent.createStandardsPanelModule({
      state,
      escapeHtml,
      escapeAttr,
      fetchJson,
      ENDPOINTS,
      unwrap,
      render,
      loadSelectedDraftReport,
      metric,
      formatNumber,
      renderChipList,
      renderInlineChipList,
      formatConfidence
    })
    : {};

  uploadController = typeof teacherContent.createUploadControllerModule === 'function'
    ? teacherContent.createUploadControllerModule({
      state,
      ENDPOINTS,
      SECTION_LABELS,
      IMPORT_PROFILES,
      escapeHtml,
      escapeAttr,
      fetchJson,
      unwrap,
      formatNumber,
      titleCase,
      passFail,
      metric,
      renderIssueList,
      renderChipList,
      renderImportScopeWarning,
      formatImportScopeLabel,
      getSelectedDraftSummary,
      getReviewProgressSummary,
      renderReviewProgressSummary,
      loadSelectedDraftReport,
      refreshDraftLists,
      clearStaleReviewCanceledMessage,
      render,
      setStatus,
      setUploadProgress,
      clearUploadProgressError,
      setUploadProgressError,
      buildUploadQueueFromFiles,
      markWaitingQueueItemsCanceled,
      summarizeUploadQueueState,
      buildUploadQueueSummaryMessage,
      processUploadQueueItem,
      formatSelectedUploadLabel,
      renderUploadQueueList,
      stepStatus
    })
    : {};

  reviewController = typeof teacherContent.createReviewControllerModule === 'function'
    ? teacherContent.createReviewControllerModule({
      state,
      fetchJson,
      ENDPOINTS,
      unwrap,
      SECTION_LABELS,
      setStatus,
      render,
      getReviewQueuePackIds,
      buildReviewQueuePacks,
      clearDraftScopedReviewUiState,
      loadSelectedDraftReport,
      refreshReviewQueueReports,
      applyApprovedSummary,
      getVisibleReviewItemsForPack,
      getPromotionBlockingReviewItems,
      isPendingReviewStatus,
      getItemReviewWorkflowStatus,
      getPromotableApprovedReviewItemCount,
      formatNumber,
      buildReviewItemRef,
      refreshDraftLists,
      reconcileSelectedReviewItem,
      formatPromotionFailureMessage,
      getDraftItemCount,
      refreshTeacherContentSummaries,
      getSelectedDraftSummary,
      getReviewProgressSummary,
      canCreateApprovedPackFromCurrentReport,
      getDraftImportScope,
      focusKnowledgeManager,
      isCurrentSelectedDraftAccepted,
      areAllReviewQueuePacksAccepted,
      getReviewStateSnapshot,
      window
    })
    : {};

  approvedController = typeof teacherContent.createApprovedControllerModule === 'function'
    ? teacherContent.createApprovedControllerModule({
      state,
      byId,
      setStatus,
      closeOverlay,
      openOverlay,
      clearDraftScopedReviewUiState,
      loadSelectedDraftReport,
      refreshReviewQueueReports,
      getReviewQueuePackIds,
      render,
      window
    })
    : {};

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

      const reviewFixBack = event.target.closest('[data-review-fix-back]');
      if (reviewFixBack) {
        event.preventDefault();
        closeReviewItem();
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

      const reviewClearSelection = event.target.closest('[data-review-clear-selection]');
      if (reviewClearSelection) {
        event.preventDefault();
        clearReviewSelection();
        return;
      }

      const reviewSort = event.target.closest('[data-review-sort]');
      if (reviewSort) {
        event.preventDefault();
        setReviewSort(reviewSort.getAttribute('data-review-sort') || '');
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
        if (acceptSelected.disabled) {
          explainDisabledAcceptSelected();
          return;
        }
        acceptSelectedReviewItems();
        return;
      }

      const acceptAll = event.target.closest('[data-review-accept-all]');
      if (acceptAll) {
        event.preventDefault();
        acceptAllReviewItems();
        return;
      }

      const rejectBlockersPromote = event.target.closest('[data-review-reject-blockers-promote]');
      if (rejectBlockersPromote) {
        event.preventDefault();
        if (rejectBlockersPromote.disabled) return;
        rejectBlockingItemsAndPromote();
        return;
      }

      const excludeSelectedFlagged = event.target.closest('[data-review-exclude-selected-flagged]');
      if (excludeSelectedFlagged) {
        event.preventDefault();
        if (excludeSelectedFlagged.disabled) return;
        excludeSelectedFlaggedReviewItems();
        return;
      }

      const excludeSelected = event.target.closest('[data-review-exclude-selected]');
      if (excludeSelected) {
        event.preventDefault();
        if (excludeSelected.disabled) return;
        excludeSelectedReviewItems();
        return;
      }

      const reviewPackSelect = event.target.closest('[data-review-pack-select]');
      if (reviewPackSelect) {
        event.preventDefault();
        selectReviewQueuePack(reviewPackSelect.getAttribute('data-review-pack-id') || '');
        return;
      }

      const reviewQueueRemove = event.target.closest('[data-review-pack-remove]');
      if (reviewQueueRemove) {
        event.preventDefault();
        removeDraftPackFromReviewQueue(reviewQueueRemove.getAttribute('data-review-pack-id') || '');
        return;
      }

      const reviewQueueCleanup = event.target.closest('[data-review-pack-cleanup]');
      if (reviewQueueCleanup) {
        event.preventDefault();
        cleanupDraftPackFromReviewQueue(reviewQueueCleanup.getAttribute('data-review-pack-id') || '');
        return;
      }

      const reviewQueueOpenApproved = event.target.closest('[data-review-pack-open-approved]');
      if (reviewQueueOpenApproved) {
        event.preventDefault();
        focusKnowledgeManager();
        return;
      }

      const reviewQueueNextPending = event.target.closest('[data-review-pack-next-pending]');
      if (reviewQueueNextPending) {
        event.preventDefault();
        moveToNextDraftNeedingReview(state.selectedDraftPackId).then((moved) => {
          if (!moved) setStatus('No draft packs still need review.');
          render();
        });
        return;
      }

      const reviewSaveEdits = event.target.closest('[data-review-save-edits]');
      if (reviewSaveEdits) {
        event.preventDefault();
        saveFocusedReviewItemEditsFromButton(reviewSaveEdits);
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

      const approvedDeleteAll = event.target.closest('[data-approved-pack-delete-all-action]');
      if (approvedDeleteAll) {
        event.preventDefault();
        deleteAllApprovedPacks();
        return;
      }

      const approvedViewEdit = event.target.closest('[data-approved-pack-view-edit-action]');
      if (approvedViewEdit) {
        event.preventDefault();
        toggleApprovedPackDetails(approvedViewEdit);
        return;
      }

      const approvedEditorClose = event.target.closest('[data-approved-pack-editor-close]');
      if (approvedEditorClose) {
        event.preventDefault();
        closeApprovedPackEditor();
        return;
      }

      const approvedItemSave = event.target.closest('[data-approved-pack-item-save]');
      if (approvedItemSave) {
        event.preventDefault();
        saveApprovedPackItem(approvedItemSave);
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

      if (event.target?.matches?.('[data-approved-pack-select-all-checkbox]')) {
        toggleApprovedPackSelectAll(event.target);
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

  async function openOverlay(...args) {
    return overlayController.openOverlay?.(...args);
  }

  function closeOverlay(...args) {
    return overlayController.closeOverlay?.(...args);
  }

  function isOverlayOpen(...args) {
    return overlayController.isOverlayOpen?.(...args);
  }

  function watchForManagerShell(...args) {
    return overlayController.watchForManagerShell?.(...args);
  }

  function applySelectedUploadFiles(...args) {
    return uploadController.applySelectedUploadFiles?.(...args);
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
    await refreshReviewQueueReports();

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
    pruneSelectedApprovedPackIds();
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
      state.reviewReportsByPackId = {
        ...(state.reviewReportsByPackId || {}),
        [state.selectedDraftPackId]: state.report
      };
      clearStaleReviewCanceledMessage();
      reconcileSelectedReviewItem();
    } catch (error) {
      state.errors.push(`Draft report failed to load: ${error.message || 'Route error'}`);
    }
  }

  async function refreshSelectedDraftReportFromBackend() {
    if (!state.selectedDraftPackId) return null;
    try {
      const data = unwrap(await fetchJson(ENDPOINTS.draftReport(state.selectedDraftPackId, state.selectedStandardsBankId)));
      state.report = data || null;
      state.reviewReportsByPackId = {
        ...(state.reviewReportsByPackId || {}),
        [state.selectedDraftPackId]: state.report
      };
      reconcileSelectedReviewItem();
      return state.report;
    } catch (error) {
      state.errors.push(`Draft report refresh failed: ${error.message || 'Route error'}`);
      return null;
    }
  }

  async function selectStandardsBank(...args) {
    return standardsPanelController.selectStandardsBank?.(...args);
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

  function renderTabs(...args) {
    return tabsController.renderTabs?.(...args);
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

  function renderDeck(...args) {
    return tabsController.renderDeck?.(...args);
  }

  function renderKnowledgeManager() {
    return renderKnowledgeManagerFromModule();
  }

  function renderSimpleKnowledgePackRows(...args) {
    return renderSimpleKnowledgePackRowsFromModule(...args);
  }

  function getVisibleKnowledgePackRows(...args) {
    return getVisibleKnowledgePackRowsFromModule(...args);
  }

  function renderDeckPreviewCard(...args) {
    return tabsController.renderDeckPreviewCard?.(...args);
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

  function renderUploadSourceCard(...args) {
    return uploadController.renderUploadSourceCard?.(...args);
  }

  function formatSelectedUploadLabel() {
    return formatSelectedUploadLabelFromModule();
  }

  function renderUploadQueueList() {
    return renderUploadQueueListFromModule();
  }

  function renderUploadQueueStatusLabel(item) {
    return renderUploadQueueStatusLabelFromModule(item);
  }

  function renderUploadStartPlanShell(...args) {
    return uploadController.renderUploadStartPlanShell?.(...args);
  }

  function renderPreviewImportCard(...args) {
    return uploadController.renderPreviewImportCard?.(...args);
  }

  function renderReviewPreviewCard(...args) {
    return uploadController.renderReviewPreviewCard?.(...args);
  }

  function renderFullImportCard(...args) {
    return uploadController.renderFullImportCard?.(...args);
  }

  function renderStandardsCard(...args) {
    return standardsPanelController.renderStandardsCard?.(...args);
  }

  function renderStandardsTools(...args) {
    return standardsPanelController.renderStandardsTools?.(...args);
  }

  function renderStandardsFilters(...args) {
    return standardsPanelController.renderStandardsFilters?.(...args);
  }

  function renderStandardsPlaceholders(...args) {
    return standardsPanelController.renderStandardsPlaceholders?.(...args);
  }

  function renderStandardsBankOptions(...args) {
    return standardsPanelController.renderStandardsBankOptions?.(...args);
  }

  function renderSelectedStandardsBankSummary(...args) {
    return standardsPanelController.renderSelectedStandardsBankSummary?.(...args);
  }

  function renderStandardCard(...args) {
    return standardsPanelController.renderStandardCard?.(...args);
  }

  function renderStandardDetailPanel(...args) {
    return standardsPanelController.renderStandardDetailPanel?.(...args);
  }

  function buildStandardsPreviewItems(...args) {
    return standardsPanelController.buildStandardsPreviewItems?.(...args);
  }

  function filterStandardsPreviewItems(...args) {
    return standardsPanelController.filterStandardsPreviewItems?.(...args);
  }

  function getStandardMatchStatus(...args) {
    return standardsPanelController.getStandardMatchStatus?.(...args);
  }

  function selectVisibleStandard(...args) {
    return standardsPanelController.selectVisibleStandard?.(...args);
  }

  function uniqueStandardValues(...args) {
    return standardsPanelController.uniqueStandardValues?.(...args);
  }

  function normalizeSearchText(...args) {
    return standardsPanelController.normalizeSearchText?.(...args);
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

  function renderReviewCard(...args) {
    return renderReviewCardFromModule(...args);
  }

  function renderReviewEmptyQueueActionBar(...args) {
    return renderReviewEmptyQueueActionBarFromModule(...args);
  }

  function renderReviewDoneCard(...args) {
    return renderReviewDoneCardFromModule(...args);
  }

  function renderReviewSummaryLine(...args) {
    return renderReviewSummaryLineFromModule(...args);
  }

  function renderBulkReviewSummary(...args) {
    return renderBulkReviewSummaryFromModule(...args);
  }

  function renderReviewQueueList(...args) {
    return renderReviewQueueListFromModule(...args);
  }

  function buildReviewQueuePacks(...args) {
    return buildReviewQueuePacksFromModule(...args);
  }

  function getReviewQueuePackIds() {
    return Array.from(new Set(
      buildReviewQueuePacks()
        .map((pack) => String(pack?.packId || '').trim())
        .filter(Boolean)
    ));
  }

  function getDraftTitleForPackId(packId) {
    const safePackId = String(packId || '').trim();
    if (!safePackId) return '';
    const matchingDraft = state.drafts.find((draft) => String(draft?.packId || '').trim() === safePackId);
    if (matchingDraft?.title) return String(matchingDraft.title).trim();
    const queuePack = buildReviewQueuePacks().find((pack) => String(pack?.packId || '').trim() === safePackId);
    if (queuePack?.title) return String(queuePack.title).trim();
    const selectedDraftTitle = state.report?.draftPack?.title;
    if (safePackId === state.selectedDraftPackId && selectedDraftTitle) return String(selectedDraftTitle).trim();
    return safePackId;
  }

  function getReviewReportForPackId(packId) {
    const safePackId = String(packId || '').trim();
    if (!safePackId) return null;
    if (safePackId === state.selectedDraftPackId && state.report) return state.report;
    const reports = state.reviewReportsByPackId && typeof state.reviewReportsByPackId === 'object'
      ? state.reviewReportsByPackId
      : {};
    return reports[safePackId] || null;
  }

  async function refreshReviewQueueReports(options = {}) {
    const force = options.force === true;
    const activeDraftPackIds = new Set(
      (Array.isArray(state.drafts) ? state.drafts : [])
        .map((draft) => String(draft?.packId || '').trim())
        .filter(Boolean)
    );
    const requestedPackIds = Array.isArray(options.packIds)
      ? options.packIds.map((packId) => String(packId || '').trim()).filter(Boolean)
      : getReviewQueuePackIds();
    const packIds = Array.from(new Set(requestedPackIds)).filter((packId) => activeDraftPackIds.has(packId));
    if (!packIds.length) {
      state.reviewReportsByPackId = {};
      state.reviewQueueReportsLoading = false;
      return;
    }

    const existingReports = state.reviewReportsByPackId && typeof state.reviewReportsByPackId === 'object'
      ? state.reviewReportsByPackId
      : {};
    const nextReports = {};
    packIds.forEach((packId) => {
      if (!force && existingReports[packId]) {
        nextReports[packId] = existingReports[packId];
      }
    });
    if (state.selectedDraftPackId && state.report && packIds.includes(state.selectedDraftPackId)) {
      nextReports[state.selectedDraftPackId] = state.report;
    }

    const packIdsToFetch = packIds.filter((packId) => force || !nextReports[packId]);
    if (!packIdsToFetch.length) {
      state.reviewReportsByPackId = nextReports;
      return;
    }

    state.reviewQueueReportsLoading = true;
    try {
      const reportResults = await Promise.allSettled(packIdsToFetch.map((packId) => {
        return fetchJson(ENDPOINTS.draftReport(packId, state.selectedStandardsBankId));
      }));
      reportResults.forEach((result, index) => {
        const packId = packIdsToFetch[index];
        if (result.status === 'fulfilled') {
          nextReports[packId] = unwrap(result.value) || null;
          return;
        }
        state.errors.push(`Draft report failed to load for ${packId}: ${result.reason?.message || 'Route error'}`);
      });
      state.reviewReportsByPackId = nextReports;
    } finally {
      state.reviewQueueReportsLoading = false;
    }
  }

  function isCurrentSelectedDraftAccepted(...args) {
    return isCurrentSelectedDraftAcceptedFromModule(...args);
  }

  function areAllReviewQueuePacksAccepted(...args) {
    return areAllReviewQueuePacksAcceptedFromModule(...args);
  }

  function summarizeDraftReviewCounts(...args) {
    return summarizeDraftReviewCountsFromModule(...args);
  }

  function getDraftItemCount(...args) {
    return getDraftItemCountFromModule(...args);
  }

  function renderReviewFilters(...args) {
    return renderReviewFiltersFromModule(...args);
  }

  function renderReviewNeedsReviewSummary(...args) {
    return renderReviewNeedsReviewSummaryFromModule(...args);
  }

  function renderReviewTable(...args) {
    return renderReviewTableFromModule(...args);
  }

  function renderReviewTableRow(...args) {
    return renderReviewTableRowFromModule(...args);
  }

  function renderReviewAdvancedDetails(...args) {
    return renderReviewAdvancedDetailsFromModule(...args);
  }

  function isPausedStandardsWarning(...args) {
    return isPausedStandardsWarningFromModule(...args);
  }

  function getFilteredReviewItems(...args) {
    return getFilteredReviewItemsFromModule(...args);
  }

  function isReviewFilterMatch(...args) {
    return isReviewFilterMatchFromModule(...args);
  }

  function setReviewListFilter(...args) {
    return setReviewListFilterFromModule(...args);
  }

  function setReviewSort(...args) {
    return setReviewSortFromModule(...args);
  }

  function getSortedReviewItems(...args) {
    return getSortedReviewItemsFromModule(...args);
  }

  function getReviewSortValue(...args) {
    return getReviewSortValueFromModule(...args);
  }

  function renderReviewSortControl(...args) {
    return renderReviewSortControlFromModule(...args);
  }

  function toggleSelectAllVisibleReviewItems(...args) {
    return toggleSelectAllVisibleReviewItemsFromModule(...args);
  }

  function clearReviewSelection(...args) {
    return clearReviewSelectionFromModule(...args);
  }

  function formatReviewItemSource(...args) {
    return formatReviewItemSourceFromModule(...args);
  }

  function shortenReviewPreview(...args) {
    return shortenReviewPreviewFromModule(...args);
  }

  function formatReviewTypeStatus(item) {
    const type = item.section === 'referenceFormulas' ? 'reference' : item.section || 'item';
    const status = item.reviewStatus || 'pending';
    const promotionBlockers = getReviewItemPromotionBlockers(item);
    return promotionBlockers.length
      ? `${type} • ${status} • blocked for promotion`
      : `${type} • ${status}`;
  }

  function getReviewInlineMessage(item) {
    if (!item) return '';
    const key = reviewItemKeyForItem(item);
    return String((state.reviewInlineMessages && state.reviewInlineMessages[key]) || '').trim();
  }

  function setReviewInlineMessage(section, index, message, draftPackId = state.selectedDraftPackId) {
    const key = reviewItemKey(draftPackId, section, index);
    if (!key) return;
    if (!message) {
      if (state.reviewInlineMessages && Object.prototype.hasOwnProperty.call(state.reviewInlineMessages, key)) {
        const next = { ...(state.reviewInlineMessages || {}) };
        delete next[key];
        state.reviewInlineMessages = next;
      }
      return;
    }
    state.reviewInlineMessages = {
      ...(state.reviewInlineMessages || {}),
      [key]: String(message)
    };
  }

  function formatReviewItemStatusLabel(item) {
    const status = getItemReviewWorkflowStatus(item);
    const blockers = getReviewItemPromotionBlockers(item);
    if (status === 'rejected') return 'Rejected / excluded';
    if (status === 'approved' && blockers.length === 0) return 'Ready for approved pack';
    if (status === 'approved' && blockers.length > 0) {
      return `Reviewed, not promotion-ready: ${formatReviewBlockerSummary(blockers)}.`;
    }
    if (isPendingReviewStatus(status)) {
      const missing = getMissingRequiredReviewFields(item);
      if (missing.length) return `Needs edit: ${formatReviewBlockerSummary(missing.map((field) => `Missing required field: ${formatRequiredReviewFieldName(field)}`))}.`;
      const approvalTargetBlockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
      if (approvalTargetBlockers.length > 0) {
        return `Needs fix before approval: ${formatReviewBlockerSummary(approvalTargetBlockers)}.`;
      }
      return 'Ready for approval';
    }
    return 'Needs edit';
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
        <p>${canCreateApprovedPack ? 'This draft is ready to become an approved knowledge pack.' : 'This draft has no approved items to promote yet.'}</p>
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
    const itemKey = reviewItemKeyForItem(item);
    const selected = state.selectedReviewItemKeys.includes(itemKey);
    const safe = isReviewItemSafeToAccept(item);
    const editableFields = EDITABLE_FIELDS[item.section] || [];
    const identityAttrs = renderReviewItemIdentityDataAttrs(item);
    return `
      <div class="teacher-content-review-item ${selected ? 'selected' : ''} ${safe ? '' : 'unsafe'}" data-review-item-card data-review-item-key="${escapeAttr(itemKey)}" data-review-item-safe="${safe ? 'true' : 'false'}">
        <label class="teacher-content-review-select-control" data-review-select-control>
          <input
            type="checkbox"
            ${selected ? 'checked' : ''}
            data-review-selection-checkbox
            data-review-selection-item-key="${escapeAttr(itemKey)}"
            data-draft-pack-id="${escapeAttr(item.draftPackId || state.selectedDraftPackId || '')}"
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
          ${editableFields.length ? `<button type="button" class="small-button secondary-small" data-review-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>Edit</button>` : ''}
          ${editableFields.length ? `<button type="button" class="small-button secondary-small" data-review-edit data-review-view-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>View/Edit</button>` : ''}
          <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}" ${item.reviewStatus === 'approved' ? 'disabled' : ''}>Approve</button>
          <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}" ${item.reviewStatus === 'rejected' ? 'disabled' : ''}>Reject</button>
        </div>
      </div>
    `;
  }

  function renderReviewActionBar(...args) {
    return renderReviewActionBarFromModule(...args);
  }

  function getDraftItemWording(...args) {
    return getDraftItemWordingFromModule(...args);
  }

  function formatStandardsAlignmentStatus(item) {
    const status = item?.standardsStatusLabel
      || item?.standards?.alignmentStatus
      || 'not_aligned_yet';
    return String(status).replace(/_/g, ' ');
  }

  function getDraftItemSafetyStatus(item) {
    const promotionBlockers = getReviewItemPromotionBlockers(item);
    if (promotionBlockers.length) return promotionBlockers[0];
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

  function renderFocusedReviewItemFix(...args) {
    return renderFocusedReviewItemFixFromModule(...args);
  }

  function renderReviewIssuesToFix(...args) {
    return renderReviewIssuesToFixFromModule(...args);
  }

  function renderReviewEvidencePanel(...args) {
    return renderReviewEvidencePanelFromModule(...args);
  }

  function renderEditableField(...args) {
    return renderEditableFieldFromModule(...args);
  }

  function getReviewEditableFieldValue(...args) {
    return getReviewEditableFieldValueFromModule(...args);
  }

  function formatEditableFieldValue(...args) {
    return formatEditableFieldValueFromModule(...args);
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
    const promoted = state.promotionMessage === 'Knowledge pack approved.';
    const status = promoted ? 'Approved' : readiness.ready ? 'Ready to approve' : readiness.blockedReasons?.length ? 'Blocked' : 'Needs teacher review';
    const statusClass = promoted || readiness.ready ? 'ready' : status === 'Blocked' ? 'blocked' : 'review';
    const reviewSummary = getReviewProgressSummary(draft);
    const blockedReasons = readiness.blockedReasons || [];
    const disabledReason = readiness.ready
      ? ''
      : (blockedReasons.length ? blockedReasons.join('; ') : 'Draft not ready. Finish teacher review before promoting.');
    const promoteDisabled = !readiness.ready || state.promotionActionLoading;
    const promoteLabel = state.promotionActionLoading ? 'Approving...' : 'Approve Pack';

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
          <span>Approval copies reviewed draft content into approved knowledge packs.</span>
          <span>It will make this approved pack live for student answers.</span>
          <small>${escapeHtml(readiness.ready ? 'Existing safety checks will run again before anything is copied.' : disabledReason)}</small>
        </div>
        <button
          type="button"
          class="small-button"
          data-promote-draft
          ${promoteDisabled ? 'disabled' : ''}
          title="${escapeAttr(promoteDisabled ? disabledReason : 'Approve reviewed draft content')}"
        >${escapeHtml(promoteLabel)}</button>
      </section>
      ${renderIssueList('Warnings', state.report?.warnings)}
      ${renderIssueList('Errors', state.report?.errors)}
    `;
  }

  function renderApprovedPacksCard(...args) {
    return renderApprovedPacksCardFromModule(...args);
  }

  function renderApprovedBulkActions(...args) {
    return renderApprovedBulkActionsFromModule(...args);
  }

  function renderDraftPacksCard(...args) {
    return renderDraftPacksCardFromModule(...args);
  }

  function renderDraftPack(...args) {
    return renderDraftPackFromModule(...args);
  }

  function renderApprovedPack(...args) {
    return renderApprovedPackFromModule(...args);
  }

  function renderUploadedSourcesHistory(...args) {
    return renderUploadedSourcesHistoryFromModule(...args);
  }

  function renderUploadedSourceHistoryItem(...args) {
    return renderUploadedSourceHistoryItemFromModule(...args);
  }

  function renderApprovedSearchableSummary(...args) {
    return renderApprovedSearchableSummaryFromModule(...args);
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

  function renderFooter(...args) {
    return tabsController.renderFooter?.(...args);
  }

  function renderStatus(...args) {
    return statusController.renderStatus?.(...args);
  }

  function setStatus(...args) {
    return statusController.setStatus?.(...args);
  }

  function setUploadProgress(...args) {
    return statusController.setUploadProgress?.(...args);
  }

  function clearUploadProgressError(...args) {
    return statusController.clearUploadProgressError?.(...args);
  }

  function setUploadProgressError(...args) {
    return statusController.setUploadProgressError?.(...args);
  }

  function makeUploadProgressTeacherMessage(...args) {
    return statusController.makeUploadProgressTeacherMessage?.(...args);
  }

  function normalizeUploadProgressSuggestions(...args) {
    return statusController.normalizeUploadProgressSuggestions?.(...args);
  }

  function setActiveTab(...args) {
    return tabsController.setActiveTab?.(...args);
  }

  function shiftTab(...args) {
    return tabsController.shiftTab?.(...args);
  }

  function activeTabIndex(...args) {
    return tabsController.activeTabIndex?.(...args);
  }

  function tabLabel(...args) {
    return tabsController.tabLabel?.(...args);
  }

  function stepStatus(...args) {
    return tabsController.stepStatus?.(...args);
  }

  function getSelectedDraftSummary() {
    return state.drafts.find((draft) => draft.packId === state.selectedDraftPackId) || null;
  }

  function isDraftPackApproved(...args) {
    return approvedController.isDraftPackApproved?.(...args);
  }

  function getVisibleDraftPacks(...args) {
    return approvedController.getVisibleDraftPacks?.(...args);
  }

  async function selectReviewQueuePack(...args) {
    return reviewController.selectReviewQueuePack?.(...args);
  }

  async function removeDraftPackFromReviewQueue(...args) {
    return reviewController.removeDraftPackFromReviewQueue?.(...args);
  }

  async function cleanupDraftPackFromReviewQueue(...args) {
    return reviewController.cleanupDraftPackFromReviewQueue?.(...args);
  }

  function canOpenDoneTab(...args) {
    return reviewController.canOpenDoneTab?.(...args);
  }

  async function openReviewItem(...args) {
    return openReviewItemFromModule(...args);
  }

  async function openReviewItemEditorFromButton(...args) {
    return openReviewItemEditorFromButtonFromModule(...args);
  }

  async function openFocusedReviewItemFixFromButton(...args) {
    return openFocusedReviewItemFixFromButtonFromModule(...args);
  }

  function updateReviewSelection(...args) {
    return updateReviewSelectionFromModule(...args);
  }

  function cancelReviewWorkflow(...args) {
    return reviewController.cancelReviewWorkflow?.(...args);
  }

  async function acceptSelectedReviewItems(...args) {
    return acceptSelectedReviewItemsFromModule(...args);
  }

  function explainDisabledAcceptSelected(...args) {
    return explainDisabledAcceptSelectedFromModule(...args);
  }

  async function rejectBlockingItemsAndPromote(...args) {
    return reviewController.rejectBlockingItemsAndPromote?.(...args);
  }

  async function excludeSelectedFlaggedReviewItems(...args) {
    return excludeSelectedFlaggedReviewItemsFromModule(...args);
  }

  async function excludeSelectedReviewItems(...args) {
    return excludeSelectedReviewItemsFromModule(...args);
  }

  async function acceptAllReviewItems(...args) {
    return acceptAllReviewItemsFromModule(...args);
  }

  async function acceptReviewItems(...args) {
    return acceptReviewItemsFromModule(...args);
  }

  async function requestCombinedReviewApproval(...args) {
    return requestCombinedReviewApprovalFromModule(...args);
  }

  function resolveCombinedReviewBatchName(...args) {
    return resolveCombinedReviewBatchNameFromModule(...args);
  }

  function closeReviewItem(...args) {
    return closeReviewItemFromModule(...args);
  }

  function openReviewEvidence(...args) {
    return openReviewEvidenceFromModule(...args);
  }

  function closeReviewEvidence(...args) {
    return closeReviewEvidenceFromModule(...args);
  }

  async function updateReviewStatusFromButton(...args) {
    return updateReviewStatusFromButtonFromModule(...args);
  }

  async function patchReviewStatus(...args) {
    return patchReviewStatusFromModule(...args);
  }

  async function saveFocusedReviewItemEditsFromButton(...args) {
    return saveFocusedReviewItemEditsFromButtonFromModule(...args);
  }

  async function approveSelectedReviewItemWithCurrentEdits(...args) {
    return approveSelectedReviewItemWithCurrentEditsFromModule(...args);
  }

  function collectReviewFieldEdits(...args) {
    return collectReviewFieldEditsFromModule(...args);
  }

  async function mutateReviewDraft(...args) {
    return mutateReviewDraftFromModule(...args);
  }

  async function promoteSelectedDraft(...args) {
    return reviewController.promoteSelectedDraft?.(...args);
  }

  async function requestDraftPromotion(...args) {
    return reviewController.requestDraftPromotion?.(...args);
  }

  function hasApprovedPackExistsConflict(...args) {
    return reviewController.hasApprovedPackExistsConflict?.(...args);
  }

  async function extractSelectedUpload(...args) {
    return uploadController.extractSelectedUpload?.(...args);
  }

  async function createReviewDraftFromUpload(...args) {
    return uploadController.createReviewDraftFromUpload?.(...args);
  }

  function buildUploadQueueFromFiles(files, singleName = '') {
    return buildUploadQueueFromFilesFromModule(files, singleName);
  }

  function makeQueuePackNamesCollisionSafe(queue = []) {
    return makeQueuePackNamesCollisionSafeFromModule(queue);
  }

  function updateUploadQueueItem(queueId, updates = {}) {
    return updateUploadQueueItemFromModule(queueId, updates);
  }

  function markWaitingQueueItemsCanceled() {
    markWaitingQueueItemsCanceledFromModule();
  }

  function summarizeUploadQueueState() {
    return summarizeUploadQueueStateFromModule();
  }

  function buildUploadQueueSummaryMessage(summary) {
    return buildUploadQueueSummaryMessageFromModule(summary);
  }

  async function processUploadQueueItem(queueItem, index, total, completedPackIds) {
    return processUploadQueueItemFromModule(queueItem, index, total, completedPackIds);
  }

  function cancelRemainingUploadQueue() {
    cancelRemainingUploadQueueFromModule();
  }

  async function runPreviewImport(...args) {
    return uploadController.runPreviewImport?.(...args);
  }

  async function runFullImport(...args) {
    return uploadController.runFullImport?.(...args);
  }

  async function runSelectedImport(...args) {
    return uploadController.runSelectedImport?.(...args);
  }

  async function runRecommendedImport(...args) {
    return uploadController.runRecommendedImport?.(...args);
  }

  async function prepareReviewFromUpload(...args) {
    return uploadController.prepareReviewFromUpload?.(...args);
  }

  function isCurrentPrepareReviewRequest(...args) {
    return uploadController.isCurrentPrepareReviewRequest?.(...args);
  }

  function stopUploadGeneration(...args) {
    return uploadController.stopUploadGeneration?.(...args);
  }

  function makeSelectedImportPayload(...args) {
    return uploadController.makeSelectedImportPayload?.(...args);
  }

  function makeRecommendedImportPayload(...args) {
    return uploadController.makeRecommendedImportPayload?.(...args);
  }

  function getTextBearingPages(...args) {
    return uploadController.getTextBearingPages?.(...args);
  }

  function getFirstTextPage(...args) {
    return uploadController.getFirstTextPage?.(...args);
  }

  function applyDefaultPreviewTextPage(...args) {
    return uploadController.applyDefaultPreviewTextPage?.(...args);
  }

  function makePreviewImportPayload(...args) {
    return uploadController.makePreviewImportPayload?.(...args);
  }

  function applyPreviewRangeMode(...args) {
    return uploadController.applyPreviewRangeMode?.(...args);
  }

  function retryPreviewWithSmallerLimit(...args) {
    return uploadController.retryPreviewWithSmallerLimit?.(...args);
  }

  function getNextThreePageRange(...args) {
    return uploadController.getNextThreePageRange?.(...args);
  }

  async function applyPreparedDraftResponse(...args) {
    return uploadController.applyPreparedDraftResponse?.(...args);
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
    await refreshReviewQueueReports();
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
    await refreshReviewQueueReports();
  }

  async function toggleApprovedPackActivation(...args) {
    return toggleApprovedPackActivationFromModule(...args);
  }

  async function deleteApprovedPack(...args) {
    return deleteApprovedPackFromModule(...args);
  }

  function toggleApprovedPackSelection(...args) {
    return toggleApprovedPackSelectionFromModule(...args);
  }

  function toggleApprovedPackSelectAll(...args) {
    return toggleApprovedPackSelectAllFromModule(...args);
  }

  async function deleteApprovedPacksById(...args) {
    return deleteApprovedPacksByIdFromModule(...args);
  }

  async function deleteSelectedApprovedPacks(...args) {
    return deleteSelectedApprovedPacksFromModule(...args);
  }

  async function deleteAllApprovedPacks(...args) {
    return deleteAllApprovedPacksFromModule(...args);
  }

  async function toggleApprovedPackDetails(...args) {
    return toggleApprovedPackDetailsFromModule(...args);
  }

  function closeApprovedPackEditor(...args) {
    return closeApprovedPackEditorFromModule(...args);
  }

  async function saveApprovedPackItem(...args) {
    return saveApprovedPackItemFromModule(...args);
  }

  function applyApprovedSummary(...args) {
    return applyApprovedSummaryFromModule(...args);
  }

  function pruneSelectedApprovedPackIds(...args) {
    return pruneSelectedApprovedPackIdsFromModule(...args);
  }

  function reconcileSelectedReviewItem() {
    if (state.selectedReviewItem) {
      const next = findReviewItem(
        state.selectedReviewItem.section,
        Number(state.selectedReviewItem.index),
        state.selectedReviewItem.draftPackId || state.selectedDraftPackId
      );
      state.selectedReviewItem = next || null;
    }
    if (state.activeFixItem) {
      const fixDraftId = String(state.activeFixItem.draftId || '').trim();
      if (fixDraftId && state.selectedDraftPackId && fixDraftId !== state.selectedDraftPackId) {
        state.activeFixItem = null;
      } else {
        const nextFix = getActiveFixReviewItem();
        if (nextFix) {
          state.activeFixItem = makeActiveFixItem(nextFix, {
            draftId: fixDraftId || state.selectedDraftPackId,
            itemRef: buildReviewItemRef(nextFix)
          });
        }
      }
    }
    if (state.selectedReviewEvidenceItem) {
      const nextEvidence = findReviewItem(
        state.selectedReviewEvidenceItem.section,
        Number(state.selectedReviewEvidenceItem.index),
        state.selectedReviewEvidenceItem.draftPackId || state.selectedDraftPackId
      );
      state.selectedReviewEvidenceItem = nextEvidence || null;
    }
    const visibleKeys = new Set(getVisibleReviewItems().map((item) => reviewItemKeyForItem(item)));
    state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => visibleKeys.has(key));
  }

  function refreshFocusedReviewItemState(previousItem, previousItemRef = null) {
    if (!previousItem) return null;
    const draftPackId = previousItem?.draftPackId || state.selectedDraftPackId;
    const refreshedItem = findReviewItemByIdentity(
      previousItem.section,
      Number(previousItem.index),
      previousItemRef || buildReviewItemRef(previousItem),
      draftPackId
    ) || findReviewItem(previousItem.section, Number(previousItem.index), draftPackId);
    if (!refreshedItem) return null;
    state.activeFixItem = makeActiveFixItem(refreshedItem, {
      draftId: draftPackId,
      itemRef: buildReviewItemRef(refreshedItem)
    });
    return refreshedItem;
  }

  function isReviewConflictError(error) {
    const status = Number(error?.status || error?.statusCode || error?.data?.status || error?.data?.statusCode);
    if (status === 409) return true;
    const text = [
      error?.message,
      ...(Array.isArray(error?.errors) ? error.errors : []),
      ...(Array.isArray(error?.data?.errors) ? error.data.errors : [])
    ].filter(Boolean).join(' ');
    return /selected draft item changed|multiple draft items matched|conflict/i.test(text);
  }

  async function refreshFocusedReviewItemAfterConflict(item, itemRef = null, message = 'This item was refreshed. Try the action again.') {
    await refreshDraftLists();
    await refreshSelectedDraftReportFromBackend();
    const refreshedItem = refreshFocusedReviewItemState(item, itemRef);
    const messageTarget = refreshedItem || item;
    if (messageTarget) {
      setReviewInlineMessage(messageTarget.section, messageTarget.index, message);
    }
    state.reviewBulkMessage = message;
    state.errors.push(message);
    setStatus(message);
    return refreshedItem;
  }

  function findReviewItem(section, index, draftPackId = state.selectedDraftPackId) {
    const items = getReviewItemsForPack(draftPackId, section);
    return items.find((item) => Number(item.index) === Number(index)) || null;
  }

  function getActiveFixReviewItem() {
    const fix = state.activeFixItem;
    if (!fix) return null;
    const draftId = String(fix.draftId || '').trim();
    if (draftId && state.selectedDraftPackId && draftId !== state.selectedDraftPackId) return null;
    return findReviewItemByIdentity(fix.section, Number(fix.index), fix.itemRef) || null;
  }

  function makeActiveFixItem(item, options = {}) {
    const itemRef = options.itemRef || buildReviewItemRef(item) || null;
    return {
      draftId: String(options.draftId || state.selectedDraftPackId || '').trim(),
      section: String(item?.section || '').trim(),
      category: String(item?.section || '').trim(),
      index: Number(item?.index),
      itemRef
    };
  }

  function findReviewItemFromButton(button, fallbackDraftPackId = '') {
    const section = String(button?.dataset?.section || '').trim();
    const index = Number(button?.dataset?.index);
    const itemRef = buildReviewItemRefFromButton(button);
    const draftPackId = String(button?.dataset?.draftPackId || fallbackDraftPackId || itemRef?.draftPackId || '').trim();
    return findReviewItemByIdentity(section, index, itemRef, draftPackId);
  }

  function findReviewItemByIdentity(section, index, itemRef = null, draftPackId = state.selectedDraftPackId) {
    const sectionItems = section ? getReviewItemsForPack(draftPackId, section) : [];
    const allItems = getAllReviewItemsForPack(draftPackId);
    const searchList = sectionItems.length ? sectionItems : allItems;
    if (Number.isInteger(index)) {
      const exactMatch = searchList.find((item) => Number(item.index) === index && (!section || item.section === section) && reviewItemMatchesRef(item, itemRef));
      if (exactMatch) return exactMatch;
      const indexedMatch = searchList.find((item) => Number(item.index) === index && (!section || item.section === section));
      if (indexedMatch) return indexedMatch;
    }
    const refMatch = searchList.find((item) => (!section || item.section === section) && reviewItemMatchesRef(item, itemRef));
    if (refMatch) return refMatch;
    return null;
  }

  function reviewItemMatchesRef(item, itemRef = null) {
    if (!item || typeof item !== 'object' || !itemRef) return false;
    const candidate = buildReviewItemRef(item);
    if (!candidate) return false;
    const draftPackId = String(itemRef.draftPackId || '').trim();
    const itemId = String(itemRef.itemId || '').trim();
    const sourceFile = String(itemRef.sourceFile || '').trim();
    const sourceLocation = String(itemRef.sourceLocation || '').trim();
    const term = String(itemRef.term || '').trim();
    const title = String(itemRef.title || '').trim();
    if (draftPackId && candidate.draftPackId !== draftPackId) return false;
    if (itemId && candidate.itemId !== itemId) return false;
    if (sourceFile && candidate.sourceFile !== sourceFile) return false;
    if (sourceLocation && candidate.sourceLocation !== sourceLocation) return false;
    if (itemId || sourceFile || sourceLocation) return true;
    if (term && candidate.term === term) return true;
    if (title && candidate.title === title) return true;
    return false;
  }

  function renderReviewItemIdentityDataAttrs(item) {
    const ref = buildReviewItemRef(item) || {};
    return [
      ` data-item-id="${escapeAttr(ref.itemId || '')}"`,
      ` data-source-file="${escapeAttr(ref.sourceFile || '')}"`,
      ` data-source-location="${escapeAttr(ref.sourceLocation || '')}"`,
      ` data-item-title="${escapeAttr(ref.title || '')}"`,
      ` data-item-term="${escapeAttr(ref.term || '')}"`,
      ` data-draft-pack-id="${escapeAttr(item?.draftPackId || state.selectedDraftPackId || '')}"`
    ].join('');
  }

  function buildReviewItemRefFromButton(button) {
    if (!button) return null;
    const itemId = String(button.getAttribute('data-item-id') || '').trim();
    const sourceFile = String(button.getAttribute('data-source-file') || '').trim();
    const sourceLocation = String(button.getAttribute('data-source-location') || '').trim();
    const title = String(button.getAttribute('data-item-title') || '').trim();
    const term = String(button.getAttribute('data-item-term') || '').trim();
    const draftPackId = String(button.getAttribute('data-draft-pack-id') || '').trim();
    if (!itemId && !sourceFile && !sourceLocation && !title && !term && !draftPackId) return null;
    return {
      draftPackId,
      itemId,
      sourceFile,
      sourceLocation,
      title,
      term
    };
  }

  function scrollReviewItemIntoView(item) {
    if (!item) return;
    const key = reviewItemKeyForItem(item);
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-review-item-key="${escapeCssSelectorValue(key)}"]`);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function scrollFocusedFixViewIntoView() {
    requestAnimationFrame(() => {
      const panel = document.querySelector('[data-review-focused-fix]');
      if (panel && typeof panel.scrollIntoView === 'function') {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const firstField = panel?.querySelector?.('[data-review-field]');
      if (firstField && typeof firstField.focus === 'function') {
        firstField.focus({ preventScroll: true });
      }
    });
  }

  function escapeCssSelectorValue(value) {
    const text = String(value || '');
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(text);
    }
    return text.replace(/["\\]/g, '\\$&');
  }

  function findPendingItemByKey(key) {
    return getVisibleReviewItems().find((item) => reviewItemKeyForItem(item) === key) || null;
  }

  function getVisibleReviewItems() {
    return getAllReviewItems().filter((item) => isItemVisibleInSimpleReviewList(item));
  }

  function getVisibleReviewItemsForPack(packId = state.selectedDraftPackId) {
    const safePackId = String(packId || '').trim();
    if (!safePackId) return [];
    return getVisibleReviewItems().filter((item) => String(item?.draftPackId || '').trim() === safePackId);
  }

  function getItemReviewWorkflowStatus(item) {
    if (!item || typeof item !== 'object') return '';
    return [item.reviewStatus, item.status, item.workflowStatus, item.approvalStatus]
      .map((value) => String(value || '').trim().toLowerCase())
      .find(Boolean) || '';
  }

  function isItemNeedingTeacherReview(item) {
    const status = getItemReviewWorkflowStatus(item);
    if (isPendingReviewStatus(status)) return true;
    return status === 'approved' && getReviewItemPromotionBlockers(item).length > 0;
  }

  function isItemVisibleInSimpleReviewList(item) {
    const status = getItemReviewWorkflowStatus(item);
    if (status === 'rejected') return false;
    if (status === 'approved') return getReviewItemPromotionBlockers(item).length > 0;
    return true;
  }

  function isPendingReviewStatus(reviewStatus) {
    const normalized = String(reviewStatus || '').trim().toLowerCase();
    return normalized === 'pending' || normalized === 'needs_review' || normalized === 'needs-review';
  }

  function reviewItemKey(draftPackId, section, index) {
    if (!section && !Number.isInteger(index)) return '';
    const safeDraftPackId = String(draftPackId || '').trim() || 'draft';
    return `${safeDraftPackId}:${section}:${Number(index)}`;
  }

  function reviewItemKeyForItem(item) {
    return reviewItemKey(item?.draftPackId || state.selectedDraftPackId, item?.section, Number(item?.index));
  }

  function buildReviewItemRef(item) {
    if (!item || typeof item !== 'object') return null;
    const draftPackId = String(item.draftPackId || state.selectedDraftPackId || '').trim();
    const itemId = String(item.itemId || item.term || item.title || item.question || item.equation || item.standardId || '').trim();
    const sourceFile = String(item.sourceFile || '').trim();
    const sourceLocation = String(item.sourceLocation || '').trim();
    const title = ['concepts', 'referenceFormulas'].includes(item.section) ? String(item.title || '').trim() : '';
    const term = item.section === 'vocabulary' ? String(item.term || '').trim() : '';
    if (!draftPackId && !itemId && !sourceFile && !sourceLocation && !title && !term) return null;
    return {
      draftPackId,
      itemId,
      sourceFile,
      sourceLocation,
      title,
      term
    };
  }

  function makePromotionSelectionItem(item) {
    return {
      section: String(item?.section || ''),
      index: Number(item?.index),
      itemRef: buildReviewItemRef(item)
    };
  }

  function getReviewItemPrimaryLabel(item) {
    if (!item || typeof item !== 'object') return 'Draft item';
    return String(
      item.term
      || item.title
      || item.label
      || item.question
      || item.equation
      || item.standardId
      || item.itemId
      || 'Draft item'
    ).trim();
  }

  function isReviewItemSafeToAccept(item) {
    if (!item) return false;
    const reviewStatus = getItemReviewWorkflowStatus(item);
    if (!isPendingReviewStatus(reviewStatus)) return false;
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
    const approvalTargetBlockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
    if (approvalTargetBlockers.length) return false;
    return true;
  }

  function isApprovedReviewItemSafeForPromotion(item) {
    return getItemReviewWorkflowStatus(item) === 'approved' && getReviewItemPromotionBlockers(item).length === 0;
  }

  function isReviewItemReadyForPack(item) {
    return isReviewItemSafeToAccept(item) || isApprovedReviewItemSafeForPromotion(item);
  }

  function isLowConfidenceOnlyPromotionBlockers(blockers) {
    return Array.isArray(blockers)
      && blockers.length > 0
      && blockers.every((blocker) => /teacher verification:\s*low confidence/i.test(String(blocker || '')));
  }

  function getAcceptSelectedBlockersForItem(item) {
    if (!item || typeof item !== 'object') return ['Draft item is not valid for acceptance.'];
    if (isReviewItemReadyForPack(item)) return [];

    const status = getItemReviewWorkflowStatus(item);
    if (isPendingReviewStatus(status)) {
      const approvalTargetBlockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
      if (isLowConfidenceOnlyPromotionBlockers(approvalTargetBlockers)) {
        return [];
      }
      return approvalTargetBlockers;
    }

    if (status === 'approved') {
      return getReviewItemPromotionBlockers(item);
    }

    return ['Row is not ready for acceptance yet.'];
  }

  function isReviewItemSelectableForAcceptSelected(item) {
    return getAcceptSelectedBlockersForItem(item).length === 0;
  }

  function canTeacherApproveBlockedItem(item) {
    if (!item || !isPendingReviewStatus(getItemReviewWorkflowStatus(item))) return false;
    const blockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
    if (!blockers.length) return true;
    return blockers.every((blocker) => /teacher verification: low confidence/i.test(String(blocker || '')));
  }

  function getAllReviewItems() {
    const packIds = getReviewQueuePackIds();
    if (!packIds.length && state.selectedDraftPackId) {
      return getAllReviewItemsForPack(state.selectedDraftPackId).filter(Boolean);
    }
    return packIds.flatMap((packId) => getAllReviewItemsForPack(packId)).filter(Boolean);
  }

  function getPromotionBlockingReviewItems(items = getAllReviewItems()) {
    return (Array.isArray(items) ? items : []).filter((item) => {
      return getItemReviewWorkflowStatus(item) === 'approved' && getReviewItemPromotionBlockers(item).length > 0;
    });
  }

  function getPromotableApprovedReviewItemCount(items = getAllReviewItemsForPack(state.selectedDraftPackId)) {
    return (Array.isArray(items) ? items : []).filter((item) => {
      return getItemReviewWorkflowStatus(item) === 'approved' && getReviewItemPromotionBlockers(item).length === 0;
    }).length;
  }

  function getReviewStateSnapshot() {
    const allItems = getAllReviewItems();
    const reviewableItems = allItems.filter((item) => isItemVisibleInSimpleReviewList(item));
    const filteredReviewableItems = getFilteredReviewItems(reviewableItems);
    const pendingCount = allItems.filter((item) => isPendingReviewStatus(getItemReviewWorkflowStatus(item))).length;
    const readyPromotableCount = allItems.filter((item) => {
      return getItemReviewWorkflowStatus(item) === 'approved' && getReviewItemPromotionBlockers(item).length === 0;
    }).length;
    return {
      allItems,
      reviewableItems,
      filteredReviewableItems,
      pendingCount,
      readyPromotableCount
    };
  }

  function selectedReviewItemsHaveBlockers() {
    const selected = getSelectedReviewItems();
    return selected.some((item) => getAcceptSelectedBlockersForItem(item).length > 0);
  }

  function getSelectedReviewItems() {
    return getVisibleReviewItems().filter((item) => {
      return state.selectedReviewItemKeys.includes(reviewItemKeyForItem(item));
    });
  }

  function isReviewItemBlockingPromotion(item) {
    return getItemReviewWorkflowStatus(item) === 'approved' && getReviewItemPromotionBlockers(item).length > 0;
  }

  function getReviewItemPromotionBlockers(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const status = getItemReviewWorkflowStatus(item);
    if (status !== 'approved') return [];
    const blockers = [];
    getMissingRequiredReviewFields(item).forEach((fieldName) => {
      blockers.push(`Missing required field: ${formatRequiredReviewFieldName(fieldName)}`);
    });
    const sourceGrounding = item.sourceGrounding && typeof item.sourceGrounding === 'object' && !Array.isArray(item.sourceGrounding)
      ? item.sourceGrounding
      : null;
    if (sourceGrounding) {
      if (sourceGrounding.status !== 'supported') {
        blockers.push('Needs stronger source evidence before promotion');
      }
      if (sourceGrounding.termOrTitleFound === false || sourceGrounding.explanationSupported === false) {
        blockers.push('Needs source evidence that matches the item before promotion');
      }
    }
    if (isLowConfidenceValue(item.confidence) && !hasTeacherLowConfidenceOverride(item)) {
      blockers.push('Needs teacher verification: low confidence');
    }
    if (item.section === 'referenceFormulas' && String(item.solverStatus || '').trim() !== 'reference_only') {
      blockers.push('Reference formula must keep solverStatus reference_only');
    }
    return Array.from(new Set(blockers));
  }

  function isLowConfidenceValue(confidence) {
    return String(confidence || '').trim().toLowerCase() === 'low';
  }

  function hasTeacherLowConfidenceOverride(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.teacherVerified === true) return true;
    if (item.teacherReviewed === true) return true;
    if (item.manuallyEdited === true) return true;
    const override = String(
      item.confidenceOverride
      || item.confidenceStatus
      || item.reviewConfidence
      || item.teacherConfidence
      || ''
    ).trim().toLowerCase();
    return override === 'teacher_verified' || override === 'teacher-reviewed';
  }

  function summarizeReviewItemActionNeeded(item) {
    const blockers = getReviewItemPromotionBlockers(item);
    if (!blockers.length && isReviewItemSafeToAccept(item)) {
      return {
        message: 'Ready to accept.',
        fixRequired: false
      };
    }
    if (!blockers.length && isPendingReviewStatus(getItemReviewWorkflowStatus(item))) {
      const approvalTargetBlockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
      if (approvalTargetBlockers.length) {
        const category = categorizePromotionBlockers(approvalTargetBlockers);
        return {
          message: `Fix ${category.label.toLowerCase()} before accepting this item, or delete it from the pack.`,
          fixRequired: category.id === 'source' || category.id === 'required'
        };
      }
      if (hasMissingRequiredReviewFields(item)) {
        return {
          message: 'Fix required fields or source information before accepting this item, or delete it from the pack.',
          fixRequired: true
        };
      }
      return {
        message: 'Review this item, then accept it or reject/exclude it from the pack.',
        fixRequired: false
      };
    }
    const category = categorizePromotionBlockers(blockers);
    const categoryLabel = category.label.toLowerCase();
    return {
      message: `Blocking approval because of ${categoryLabel}. Edit this item or delete it from the pack.`,
      fixRequired: category.id === 'source' || category.id === 'required'
    };
  }

  function formatPromotionFailureMessage(readiness, items = getVisibleReviewItemsForPack(state.selectedDraftPackId)) {
    const rowBlockers = getPromotionBlockingReviewItems(items);
    if (rowBlockers.length) {
      const categoryCounts = summarizePromotionBlockerCategories(rowBlockers);
      const [category, count] = categoryCounts[0] || ['promotion requirements', rowBlockers.length];
      return `${formatNumber(rowBlockers.length)} item${rowBlockers.length === 1 ? '' : 's'} ${rowBlockers.length === 1 ? 'is' : 'are'} blocking approval because ${formatNumber(count)} ${count === 1 ? 'item is' : 'items are'} in ${category}. Edit or reject these items before approving the pack.`;
    }
    const reasons = Array.isArray(readiness?.blockedReasons) ? readiness.blockedReasons.filter(Boolean) : [];
    const pendingReasons = reasons.filter((reason) => /pending/i.test(String(reason || '')));
    if (pendingReasons.length) {
      return `${formatNumber(pendingReasons.length)} promotion check${pendingReasons.length === 1 ? '' : 's'} still report pending review. Accept valid items or reject/exclude items before approving the pack.`;
    }
    if (reasons.length) {
      return `${formatNumber(reasons.length)} promotion blocker${reasons.length === 1 ? '' : 's'} remain: ${reasons.slice(0, 3).join('; ')}. Edit or reject blocking items before approving the pack.`;
    }
    return 'Approval is still blocked. Edit or reject blocking items before approving the pack.';
  }

  function makePostEditSaveMessage(refreshedItem, previousItem) {
    const effectiveItem = refreshedItem || previousItem;
    if (!effectiveItem) return 'Saved draft item edits.';
    const status = getItemReviewWorkflowStatus(effectiveItem);
    const approvalTarget = status === 'approved' ? effectiveItem : { ...effectiveItem, reviewStatus: 'approved' };
    const blockers = getReviewItemPromotionBlockers(approvalTarget);
    if (blockers.length === 0) {
      return 'Saved. This item is now ready for approval.';
    }
    return `Saved, but this item still needs: ${formatReviewBlockerSummary(blockers)}.`;
  }

  function formatReviewBlockerSummary(blockers) {
    const cleaned = (Array.isArray(blockers) ? blockers : [])
      .map((blocker) => String(blocker || '').replace(/^approved item\s+/i, '').trim())
      .filter(Boolean);
    return cleaned.slice(0, 3).join('; ');
  }

  function summarizePromotionBlockerCategories(items) {
    const counts = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const blockers = getReviewItemPromotionBlockers(item);
      const category = categorizePromotionBlockers(blockers).label;
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  function categorizePromotionBlockers(blockers) {
    const text = (Array.isArray(blockers) ? blockers : []).join(' ').toLowerCase();
    if (/source|ground|evidence|match extracted/.test(text)) return { id: 'source', label: 'missing required source information' };
    if (/required|missing/.test(text)) return { id: 'required', label: 'missing required fields' };
    if (/low confidence/.test(text)) return { id: 'confidence', label: 'low confidence' };
    if (/solverstatus|reference_only|formula/.test(text)) return { id: 'formula', label: 'formula safety settings' };
    return { id: 'promotion', label: 'promotion requirements' };
  }

  function hasMissingRequiredReviewFields(item) {
    return getMissingRequiredReviewFields(item).length > 0;
  }

  function getMissingRequiredReviewFields(item) {
    if (!item || typeof item !== 'object') return ['item'];
    const requiredBySection = {
      vocabulary: ['term'],
      concepts: ['title'],
      referenceFormulas: ['title', 'equation'],
      problemBank: ['question'],
      standardsMap: ['standardId'],
      smokeTests: ['question']
    };
    const required = requiredBySection[item.section] || [];
    const missing = required.filter((field) => !String(item[field] || '').trim());
    if (!String(item.sourceFile || '').trim()) missing.push('sourceFile');
    if (!String(item.sourceLocation || '').trim()) missing.push('sourceLocation');
    if (!String(item.sourceTextSnippet || '').trim()) missing.push('sourceTextSnippet');
    return missing;
  }

  function formatRequiredReviewFieldName(fieldName) {
    const labels = {
      item: 'draft item',
      sourceFile: 'source file',
      sourceLocation: 'source location',
      sourceTextSnippet: 'source text',
      studentDefinition: 'student-friendly definition',
      studentExplanation: 'student-friendly explanation',
      expectedAnswer: 'expected answer',
      standardId: 'standard ID'
    };
    return labels[fieldName] || titleCase(fieldName).toLowerCase();
  }

  function getReviewIssueBlockersForItem(item) {
    if (!item || typeof item !== 'object') return ['Missing required field: draft item'];
    if (getItemReviewWorkflowStatus(item) === 'rejected') return ['Rejected / excluded'];
    return getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
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

  function formatTextBearingPages(...args) {
    return uploadController.formatTextBearingPages?.(...args);
  }

  function renderImportEstimatePanel(...args) {
    return uploadController.renderImportEstimatePanel?.(...args);
  }

  function renderAutoImportPlanPanel(...args) {
    return uploadController.renderAutoImportPlanPanel?.(...args);
  }

  function renderRecommendedImportAction(...args) {
    return uploadController.renderRecommendedImportAction?.(...args);
  }

  function humanizeImportScope(...args) {
    return uploadController.humanizeImportScope?.(...args);
  }

  function renderPreviewSizeControls(...args) {
    return uploadController.renderPreviewSizeControls?.(...args);
  }

  function renderPreviewReportPanel(...args) {
    return uploadController.renderPreviewReportPanel?.(...args);
  }

  function renderPreviewRepairDetails(...args) {
    return uploadController.renderPreviewRepairDetails?.(...args);
  }

  function renderPreviewPackItems(...args) {
    return uploadController.renderPreviewPackItems?.(...args);
  }

  function previewItemLabel(...args) {
    return uploadController.previewItemLabel?.(...args);
  }

  function renderModelCrashGuidance(...args) {
    return uploadController.renderModelCrashGuidance?.(...args);
  }

  function renderPreviewDeduplicationDetails(...args) {
    return uploadController.renderPreviewDeduplicationDetails?.(...args);
  }

  function renderSelectedImportControls(...args) {
    return uploadController.renderSelectedImportControls?.(...args);
  }

  function renderWholeImportAdvanced(...args) {
    return uploadController.renderWholeImportAdvanced?.(...args);
  }

  function getPreviewImportNote(...args) {
    return uploadController.getPreviewImportNote?.(...args);
  }

  function renderPrepareReviewFailurePanel(...args) {
    return uploadController.renderPrepareReviewFailurePanel?.(...args);
  }

  function normalizePrepareReviewFailureMessage(...args) {
    return uploadController.normalizePrepareReviewFailureMessage?.(...args);
  }

  function makePrepareReviewBackendDetails(...args) {
    return uploadController.makePrepareReviewBackendDetails?.(...args);
  }

  function makePrepareReviewRecoverySuggestions(...args) {
    return uploadController.makePrepareReviewRecoverySuggestions?.(...args);
  }

  function getFirstTextPageFromFailure(...args) {
    return uploadController.getFirstTextPageFromFailure?.(...args);
  }

  function renderPrepareReviewFailureItemDetails(...args) {
    return uploadController.renderPrepareReviewFailureItemDetails?.(...args);
  }

  function formatImportSelectionRange(...args) {
    return uploadController.formatImportSelectionRange?.(...args);
  }

  function formatBackendDetail(...args) {
    return uploadController.formatBackendDetail?.(...args);
  }

  function formatFailedBatchDetail(...args) {
    return uploadController.formatFailedBatchDetail?.(...args);
  }

  function formatFailedBatchPageNotice(...args) {
    return uploadController.formatFailedBatchPageNotice?.(...args);
  }

  function formatCompactNumberRange(...args) {
    return uploadController.formatCompactNumberRange?.(...args);
  }

  function isModelRuntimeCrashPayload(...args) {
    return uploadController.isModelRuntimeCrashPayload?.(...args);
  }

  function isTeacherContentAnalysisFailurePayload(...args) {
    return uploadController.isTeacherContentAnalysisFailurePayload?.(...args);
  }

  function isModelUnavailablePayload(...args) {
    return uploadController.isModelUnavailablePayload?.(...args);
  }

  function isInvalidModelResponsePayload(...args) {
    return uploadController.isInvalidModelResponsePayload?.(...args);
  }

  function isModelRuntimeTimeoutPayload(...args) {
    return uploadController.isModelRuntimeTimeoutPayload?.(...args);
  }

  function uniqueStrings(...args) {
    return uploadController.uniqueStrings?.(...args);
  }

  function renderFailedBatchSummary(...args) {
    return uploadController.renderFailedBatchSummary?.(...args);
  }

  function renderPrepareReviewHandoff(...args) {
    return uploadController.renderPrepareReviewHandoff?.(...args);
  }

  function renderUploadCreateProgress(...args) {
    return uploadController.renderUploadCreateProgress?.(...args);
  }

  function normalizeUploadProgress(...args) {
    return uploadController.normalizeUploadProgress?.(...args);
  }

  function renderUploadProgressErrorPanel(...args) {
    return uploadController.renderUploadProgressErrorPanel?.(...args);
  }

  function getPlannedBatchDetail(...args) {
    return uploadController.getPlannedBatchDetail?.(...args);
  }

  function getGenerateProgressDetail(...args) {
    return uploadController.getGenerateProgressDetail?.(...args);
  }

  function renderImportActivityPanel(...args) {
    return uploadController.renderImportActivityPanel?.(...args);
  }

  function renderImportActivityEntry(...args) {
    return uploadController.renderImportActivityEntry?.(...args);
  }

  function renderImportActivityDetails(...args) {
    return uploadController.renderImportActivityDetails?.(...args);
  }

  function makeStagedImportTimeline(...args) {
    return uploadController.makeStagedImportTimeline?.(...args);
  }

  function appendImportActivity(...args) {
    return uploadController.appendImportActivity?.(...args);
  }

  function applyImportTimeline(...args) {
    return uploadController.applyImportTimeline?.(...args);
  }

  function dedupeTimelineEntries(...args) {
    return uploadController.dedupeTimelineEntries?.(...args);
  }

  function timelineDetailScore(...args) {
    return uploadController.timelineDetailScore?.(...args);
  }

  function renderUploadExtractionSummary(...args) {
    return uploadController.renderUploadExtractionSummary?.(...args);
  }

  function renderAdvancedUploadDetails(...args) {
    return uploadController.renderAdvancedUploadDetails?.(...args);
  }

  function renderSourceMatchPanel(...args) {
    return uploadController.renderSourceMatchPanel?.(...args);
  }

  function getCurrentSourceMatch(...args) {
    return uploadController.getCurrentSourceMatch?.(...args);
  }

  function isPreparedDraftSelectionMismatch(...args) {
    return uploadController.isPreparedDraftSelectionMismatch?.(...args);
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
    return getReviewItemGroupsFromReport(state.report);
  }

  function getReviewItemGroupsFromReport(report = state.report) {
    const reviewGroups = report?.reviewItems?.items;
    if (hasGroupRows(reviewGroups)) return reviewGroups;
    const pendingGroups = report?.pendingReview?.items;
    if (hasGroupRows(pendingGroups)) return pendingGroups;
    return buildFallbackReviewGroupsFromDraftPacket(report?.draftPacketItems || {});
  }

  function getReviewItemsForPack(packId, section = '') {
    const safePackId = String(packId || '').trim();
    if (!safePackId) return [];
    const report = getReviewReportForPackId(safePackId);
    if (!report) return [];
    const groups = getReviewItemGroupsFromReport(report);
    const sourcePackName = String(report?.draftPack?.title || getDraftTitleForPackId(safePackId) || safePackId).trim();
    if (section) {
      const rows = Array.isArray(groups?.[section]) ? groups[section] : [];
      return rows.map((item, index) => enrichReviewItemWithPackIdentity(item, {
        draftPackId: safePackId,
        sourcePackName,
        section,
        index
      }));
    }
    return REVIEW_GROUP_ORDER.flatMap((sectionName) => {
      const rows = Array.isArray(groups?.[sectionName]) ? groups[sectionName] : [];
      return rows.map((item, index) => enrichReviewItemWithPackIdentity(item, {
        draftPackId: safePackId,
        sourcePackName,
        section: sectionName,
        index
      }));
    });
  }

  function getAllReviewItemsForPack(packId) {
    return getReviewItemsForPack(packId);
  }

  function enrichReviewItemWithPackIdentity(item, context = {}) {
    const safeItem = item && typeof item === 'object' ? item : {};
    const resolvedSection = String(context.section || safeItem.section || '').trim();
    const resolvedIndex = Number.isInteger(Number(safeItem.index))
      ? Number(safeItem.index)
      : Number.isInteger(Number(context.index))
        ? Number(context.index)
        : 0;
    const draftPackId = String(context.draftPackId || safeItem.draftPackId || state.selectedDraftPackId || '').trim();
    const sourcePackName = String(context.sourcePackName || safeItem.sourcePackName || getDraftTitleForPackId(draftPackId) || draftPackId).trim();
    return {
      ...safeItem,
      section: resolvedSection,
      index: resolvedIndex,
      draftPackId,
      sourcePackName,
      originalItemData: safeItem.originalItemData || safeItem.originalItem || { ...safeItem }
    };
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
      teacherReviewed: safeItem.teacherReviewed === true,
      teacherVerified: safeItem.teacherVerified === true,
      manuallyEdited: safeItem.manuallyEdited === true,
      confidenceOverride: safeItem.confidenceOverride || '',
      editableFields: {}
    };
  }

  function hasAnyPrimaryDraftItems() {
    return getAllReviewItems().length > 0;
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
    state.activeFixItem = null;
    state.selectedReviewEvidenceItem = null;
    state.selectedReviewItemKeys = [];
    state.reviewListFilter = 'all';
    state.reviewNeedsReviewExpanded = false;
    state.reviewCompleted = false;
    state.reviewBulkMessage = '';
    state.reviewInlineMessages = {};
    state.reviewDebugEvents = [];
    state.promotionMessage = '';
  }

  function canCreateApprovedPackFromCurrentReport(summary) {
    return Number(summary?.approved || 0) > 0;
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
    if (status === 'Approved') return 'This draft was copied into approved knowledge packs.';
    if (status === 'Ready to approve') return 'Teacher review and validation checks are complete.';
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

  function focusKnowledgeManager(...args) {
    return approvedController.focusKnowledgeManager?.(...args);
  }

  function openDraftPackForReview(...args) {
    return approvedController.openDraftPackForReview?.(...args);
  }

  function firstError(...args) {
    return uploadController.firstError?.(...args);
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
    await refreshReviewQueueReports({ packIds: getReviewQueuePackIds() });
    state.activeTab = 'review';
    return true;
  }

  function normalizeImportProfileSelection(...args) {
    return uploadController.normalizeImportProfileSelection?.(...args);
  }

  function normalizeImportProfileForPayload(...args) {
    return uploadController.normalizeImportProfileForPayload?.(...args);
  }

  function renderImportProfileOptions(...args) {
    return uploadController.renderImportProfileOptions?.(...args);
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

  function formatStandardsBankOptionLabel(...args) {
    return standardsPanelController.formatStandardsBankOptionLabel?.(...args);
  }

  function makeContentNameFromFileName(...args) {
    return uploadController.makeContentNameFromFileName?.(...args);
  }

  function buildDefaultPackNameFromFile(...args) {
    return uploadController.buildDefaultPackNameFromFile?.(...args);
  }

  function extractNearestMeaningfulParentFolder(...args) {
    return uploadController.extractNearestMeaningfulParentFolder?.(...args);
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
