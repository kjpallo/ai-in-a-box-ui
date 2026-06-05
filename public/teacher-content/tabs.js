(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createTabsModule(deps = {}) {
    const {
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
    } = deps;

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

    function renderFooter() {
      const index = activeTabIndex();
      const back = byId('teacherContentBack');
      const next = byId('teacherContentNext');
      const footer = back?.closest('.teacher-content-footer') || next?.closest('.teacher-content-footer') || null;
      if (footer) footer.hidden = state.activeTab === 'review';
      if (back) back.disabled = index <= 0 || state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading;
      if (next) next.disabled = index >= TABS.length - 1 || state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading;
      const label = byId('teacherContentStepLabel');
      if (label) label.textContent = `${index + 1} of ${TABS.length}: ${tabLabel(state.activeTab)}`;
    }

    function setActiveTab(tabId) {
      if (!TABS.some((tab) => tab.id === tabId)) return;
      if (tabId === 'complete' && !canOpenDoneTab()) {
        setStatus('Finish review and accept items before opening Done.');
        return;
      }
      if ((state.uploadPrepareReviewLoading || state.uploadCreateReviewLoading) && tabId !== state.activeTab) {
        setStatus('Generation is still running. Stop it before leaving this step.');
        return;
      }
      state.activeTab = tabId;
      if (tabId === 'review') clearStaleReviewCanceledMessage();
      render();
    }

    function shiftTab(delta) {
      if (delta > 0 && state.activeTab === 'review') {
        if (isCurrentSelectedDraftAccepted() || areAllReviewQueuePacksAccepted()) {
          state.reviewCompleted = true;
        }
        const reviewState = getReviewStateSnapshot();
        if (reviewState.pendingCount > 0) {
          setStatus('Review still has pending items. Accept valid items or reject/exclude blockers before continuing.');
          return;
        }
        if (reviewState.readyPromotableCount > 0 && !state.reviewCompleted) {
          setStatus('Valid reviewed items are ready. Click Create Approved Pack to finish this draft.');
          return;
        }
        if (reviewState.readyPromotableCount === 0 && !state.reviewCompleted) {
          setStatus('This draft has no valid items to approve. Edit items, switch packs, or cancel.');
          return;
        }
      }
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
        return canOpenDoneTab() ? 'COMPLETE' : 'WAITING';
      }
      return 'WAITING';
    }

    return {
      renderTabs,
      renderDeck,
      renderDeckPreviewCard,
      renderFooter,
      setActiveTab,
      shiftTab,
      activeTabIndex,
      tabLabel,
      stepStatus
    };
  }

  ns.createTabsModule = createTabsModule;
})();
