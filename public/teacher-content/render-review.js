(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createRenderReviewModule(deps) {
    const { formatNumber } = deps;

    function renderReviewSummaryLine(summary = {}) {
      const sourceCount = Math.max(0, Number(summary.sourceCount || 0));
      const candidateCount = Math.max(0, Number(summary.candidateCount || 0));
      const visibleCount = Math.max(0, Number(summary.visibleCount || 0));
      if (sourceCount === 0 && candidateCount === 0) return 'No draft items were created from this review queue.';
      if (sourceCount <= 1) {
        return `${formatNumber(candidateCount)} candidate item${candidateCount === 1 ? '' : 's'} from ${formatNumber(Math.max(1, sourceCount))} source${Math.max(1, sourceCount) === 1 ? '' : 's'} • ${formatNumber(visibleCount)} visible`;
      }
      return `Reviewing ${formatNumber(sourceCount)} draft packs • ${formatNumber(candidateCount)} candidate items from ${formatNumber(sourceCount)} sources • ${formatNumber(visibleCount)} visible`;
    }

    return {
      renderReviewSummaryLine
    };
  }

  ns.createRenderReviewModule = createRenderReviewModule;
})();
