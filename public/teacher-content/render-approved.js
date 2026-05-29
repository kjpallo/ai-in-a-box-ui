(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createRenderApprovedModule(deps) {
    const {
      state,
      renderApprovedPack,
      getVisibleDraftPacks,
      renderDraftPack
    } = deps;

    function renderSimpleKnowledgePackRows() {
      const approvedRows = state.approved.map((pack) => renderApprovedPack(pack));
      const draftRows = getVisibleDraftPacks().map((draft) => renderDraftPack(draft));
      return [...approvedRows, ...draftRows].join('');
    }

    function getVisibleKnowledgePackRows() {
      const visibleRows = [];
      const seenPackIds = new Set();
      (Array.isArray(state.approved) ? state.approved : []).forEach((pack) => {
        const packId = String(pack?.packId || '').trim();
        if (packId && !seenPackIds.has(packId)) {
          seenPackIds.add(packId);
          visibleRows.push({
            kind: 'approved',
            packId,
            title: pack.title || packId
          });
        }
      });
      getVisibleDraftPacks().forEach((draft) => {
        const packId = String(draft?.packId || '').trim();
        if (packId && !seenPackIds.has(packId)) {
          seenPackIds.add(packId);
          visibleRows.push({
            kind: 'draft',
            packId,
            title: draft.title || packId
          });
        }
      });
      return visibleRows;
    }

    return {
      renderSimpleKnowledgePackRows,
      getVisibleKnowledgePackRows
    };
  }

  ns.createRenderApprovedModule = createRenderApprovedModule;
})();
