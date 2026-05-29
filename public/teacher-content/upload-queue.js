(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createUploadQueueModule(deps) {
    const {
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
    } = deps;

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

    return {
      buildUploadQueueFromFiles,
      makeQueuePackNamesCollisionSafe,
      updateUploadQueueItem,
      markWaitingQueueItemsCanceled,
      summarizeUploadQueueState,
      buildUploadQueueSummaryMessage,
      processUploadQueueItem,
      cancelRemainingUploadQueue
    };
  }

  ns.createUploadQueueModule = createUploadQueueModule;
})();
