(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createReviewActionsModule(deps) {
    const {
      state,
      getFilteredReviewItems,
      getVisibleReviewItems,
      reviewItemKeyForItem,
      render
    } = deps;

    function toggleSelectAllVisibleReviewItems() {
      const visible = getFilteredReviewItems(getVisibleReviewItems());
      const keys = visible.map((item) => reviewItemKeyForItem(item));
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

    function clearReviewSelection() {
      if (!state.selectedReviewItemKeys.length) return;
      state.selectedReviewItemKeys = [];
      state.reviewBulkMessage = '';
      render();
    }

    return {
      toggleSelectAllVisibleReviewItems,
      clearReviewSelection
    };
  }

  ns.createReviewActionsModule = createReviewActionsModule;
})();
