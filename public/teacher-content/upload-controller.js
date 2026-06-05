(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createUploadControllerModule(deps = {}) {
    const {
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
    } = deps;

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
      state.activeFixItem = null;
      state.selectedReviewEvidenceItem = null;
      state.selectedReviewItemKeys = [];
      state.reviewListFilter = 'all';
      state.reviewSortKey = 'source';
      state.reviewSortDirection = 'asc';
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
      if (combined.includes('charlemagne had trouble analyzing this file')
        || combined.includes('model response was not valid json')
        || combined.includes('model response was empty')
        || combined.includes('local gemma took too long')
        || combined.includes('local gemma crashed')
        || combined.includes('ollama returned http')
        || combined.includes('econnrefused')
        || combined.includes('connection refused')) {
        return 'Charlemagne had trouble analyzing this file.';
      }
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
      if (isTeacherContentAnalysisFailurePayload(failure)) {
        suggestions.push('Try a smaller file, fewer pages, or text-only notes.');
        suggestions.push('You can retry analysis or remove this file from the queue.');
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

    function isTeacherContentAnalysisFailurePayload(payload) {
      return isModelRuntimeTimeoutPayload(payload)
        || isModelRuntimeCrashPayload(payload)
        || isModelUnavailablePayload(payload)
        || isInvalidModelResponsePayload(payload)
        || String(payload?.teacherFriendlyError || payload?.message || '').toLowerCase().includes('charlemagne had trouble analyzing this file');
    }

    function isModelUnavailablePayload(payload) {
      const text = [
        payload?.teacherFriendlyError,
        payload?.message,
        payload?.details,
        ...(Array.isArray(payload?.errors) ? payload.errors : []),
        ...(Array.isArray(payload?.technicalErrors) ? payload.technicalErrors : []),
        ...(Array.isArray(payload?.failedBatches) ? payload.failedBatches.flatMap((batch) => batch && Array.isArray(batch.errors) ? batch.errors : []) : [])
      ].map(formatBackendDetail).join(' ').toLowerCase();
      return text.includes('econnrefused')
        || text.includes('connection refused')
        || text.includes('ollama is not running')
        || text.includes('could not connect to ollama')
        || text.includes('fetch failed');
    }

    function isInvalidModelResponsePayload(payload) {
      const text = [
        payload?.teacherFriendlyError,
        payload?.message,
        payload?.details,
        ...(Array.isArray(payload?.errors) ? payload.errors : []),
        ...(Array.isArray(payload?.technicalErrors) ? payload.technicalErrors : []),
        ...(Array.isArray(payload?.failedBatches) ? payload.failedBatches.flatMap((batch) => batch && Array.isArray(batch.errors) ? batch.errors : []) : [])
      ].map(formatBackendDetail).join(' ').toLowerCase();
      return text.includes('model response was not valid json')
        || text.includes('model response was empty')
        || text.includes('response did not contain a complete json object');
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

    function firstError(errors, fallback) {
      return Array.isArray(errors) && errors.length ? String(errors[0]) : fallback;
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

    return {
      applySelectedUploadFiles,
      renderUploadSourceCard,
      renderUploadStartPlanShell,
      renderPreviewImportCard,
      renderReviewPreviewCard,
      renderFullImportCard,
      extractSelectedUpload,
      createReviewDraftFromUpload,
      runPreviewImport,
      runFullImport,
      runSelectedImport,
      runRecommendedImport,
      prepareReviewFromUpload,
      isCurrentPrepareReviewRequest,
      stopUploadGeneration,
      makeSelectedImportPayload,
      makeRecommendedImportPayload,
      getTextBearingPages,
      getFirstTextPage,
      applyDefaultPreviewTextPage,
      makePreviewImportPayload,
      applyPreviewRangeMode,
      retryPreviewWithSmallerLimit,
      getNextThreePageRange,
      applyPreparedDraftResponse,
      formatTextBearingPages,
      renderImportEstimatePanel,
      renderAutoImportPlanPanel,
      renderRecommendedImportAction,
      humanizeImportScope,
      renderPreviewSizeControls,
      renderPreviewReportPanel,
      renderPreviewRepairDetails,
      renderPreviewPackItems,
      previewItemLabel,
      renderModelCrashGuidance,
      renderPreviewDeduplicationDetails,
      renderSelectedImportControls,
      renderWholeImportAdvanced,
      getPreviewImportNote,
      renderPrepareReviewFailurePanel,
      normalizePrepareReviewFailureMessage,
      makePrepareReviewBackendDetails,
      makePrepareReviewRecoverySuggestions,
      getFirstTextPageFromFailure,
      renderPrepareReviewFailureItemDetails,
      formatImportSelectionRange,
      formatBackendDetail,
      formatFailedBatchDetail,
      formatFailedBatchPageNotice,
      formatCompactNumberRange,
      isModelRuntimeCrashPayload,
      isTeacherContentAnalysisFailurePayload,
      isModelUnavailablePayload,
      isInvalidModelResponsePayload,
      isModelRuntimeTimeoutPayload,
      uniqueStrings,
      renderFailedBatchSummary,
      renderPrepareReviewHandoff,
      renderUploadCreateProgress,
      normalizeUploadProgress,
      renderUploadProgressErrorPanel,
      getPlannedBatchDetail,
      getGenerateProgressDetail,
      renderImportActivityPanel,
      renderImportActivityEntry,
      renderImportActivityDetails,
      makeStagedImportTimeline,
      appendImportActivity,
      applyImportTimeline,
      dedupeTimelineEntries,
      timelineDetailScore,
      renderUploadExtractionSummary,
      renderAdvancedUploadDetails,
      renderSourceMatchPanel,
      getCurrentSourceMatch,
      isPreparedDraftSelectionMismatch,
      firstError,
      normalizeImportProfileSelection,
      normalizeImportProfileForPayload,
      renderImportProfileOptions,
      makeContentNameFromFileName,
      buildDefaultPackNameFromFile,
      extractNearestMeaningfulParentFolder
    };
  }

  ns.createUploadControllerModule = createUploadControllerModule;
})();
