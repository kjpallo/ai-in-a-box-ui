(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createApprovedControllerModule(deps = {}) {
    const {
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
    } = deps;

    function isDraftPackApproved(packId) {
      const safePackId = String(packId || '').trim();
      if (!safePackId) return false;
      return state.approved.some((pack) => String(pack?.packId || '').trim() === safePackId);
    }

    function getVisibleDraftPacks() {
      const seenDraftPackIds = new Set();
      return state.drafts.filter((draft) => {
        const draftPackId = String(draft?.packId || '').trim();
        if (!draftPackId || seenDraftPackIds.has(draftPackId) || isDraftPackApproved(draftPackId)) return false;
        seenDraftPackIds.add(draftPackId);
        return true;
      });
    }

    function focusKnowledgeManager(statusMessage = 'Viewing saved knowledge packs.') {
      closeOverlay();
      window.Charlemagne?.blades?.open?.('ai-improvement', { sound: false });
      const manager = byId('teacherContentKnowledgeManager');
      if (!manager) {
        setStatus(statusMessage);
        return;
      }
      manager.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const preferredFocus = manager.querySelector('[data-approved-pack-view-edit-action]') || manager.querySelector('[data-draft-pack-view-edit-action]');
      preferredFocus?.focus();
      setStatus(statusMessage);
    }

    function openDraftPackForReview(packId) {
      if (!packId) return;
      state.selectedDraftPackId = packId;
      clearDraftScopedReviewUiState();
      state.activeTab = 'review';
      openOverlay().then(async () => {
        if (state.loadedOnce) {
          await loadSelectedDraftReport();
          await refreshReviewQueueReports({ packIds: getReviewQueuePackIds() });
        }
        render();
      });
    }

    return {
      isDraftPackApproved,
      getVisibleDraftPacks,
      focusKnowledgeManager,
      openDraftPackForReview
    };
  }

  ns.createApprovedControllerModule = createApprovedControllerModule;
})();
