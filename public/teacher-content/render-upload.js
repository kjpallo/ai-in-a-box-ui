(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createRenderUploadModule(deps) {
    const {
      state,
      escapeHtml,
      escapeAttr,
      formatNumber
    } = deps;

    function formatSelectedUploadLabel() {
      if (!state.selectedUploadFiles.length) {
        return state.selectedUploadFile?.name || state.uploadExtractionResult?.originalFileName || 'No file selected';
      }
      if (state.selectedUploadFiles.length === 1) return state.selectedUploadFiles[0].name;
      return `${state.selectedUploadFiles.length} files selected`;
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

    return {
      formatSelectedUploadLabel,
      renderUploadQueueStatusLabel,
      renderUploadQueueList
    };
  }

  ns.createRenderUploadModule = createRenderUploadModule;
})();
