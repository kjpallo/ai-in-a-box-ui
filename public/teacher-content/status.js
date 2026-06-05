(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createStatusModule(deps = {}) {
    const {
      state,
      byId,
      formatNumber,
      uniqueStrings,
      formatFailedBatchDetail,
      formatBackendDetail,
      formatFailedBatchPageNotice,
      isTeacherContentAnalysisFailurePayload
    } = deps;

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
      if (isTeacherContentAnalysisFailurePayload(data) || isTeacherContentAnalysisFailurePayload(error)) {
        return 'Charlemagne had trouble analyzing this file.';
      }
      return data.teacherFriendlyError || data.message || error?.message || error || 'Something went wrong.';
    }

    function normalizeUploadProgressSuggestions(error, suggestions = []) {
      if (isTeacherContentAnalysisFailurePayload(error?.data || error)) {
        return ['Try a smaller file, fewer pages, or text-only notes.', 'You can retry analysis or remove this file from the queue.'];
      }
      return suggestions;
    }

    return {
      renderStatus,
      setStatus,
      setUploadProgress,
      clearUploadProgressError,
      setUploadProgressError,
      makeUploadProgressTeacherMessage,
      normalizeUploadProgressSuggestions
    };
  }

  ns.createStatusModule = createStatusModule;
})();
