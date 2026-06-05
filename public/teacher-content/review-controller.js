(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createReviewControllerModule(deps = {}) {
    const {
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
    } = deps;

    async function selectReviewQueuePack(packId) {
      const nextPackId = String(packId || '').trim();
      if (!nextPackId || nextPackId === state.selectedDraftPackId) return;
      state.selectedDraftPackId = nextPackId;
      clearDraftScopedReviewUiState();
      await loadSelectedDraftReport();
      await refreshReviewQueueReports({ packIds: getReviewQueuePackIds() });
      render();
    }

    async function removeDraftPackFromReviewQueue(packId) {
      const safePackId = String(packId || '').trim();
      if (!safePackId) return;
      const selected = safePackId === state.selectedDraftPackId;
      try {
        const payload = await fetchJson(ENDPOINTS.acceptedDraftCopy(safePackId), {
          method: 'DELETE'
        });
        const data = unwrap(payload);
        if (data?.dashboard) state.dashboard = data.dashboard;
        if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        const removed = new Set(state.reviewQueueRemovedPackIds || []);
        removed.add(safePackId);
        state.reviewQueueRemovedPackIds = Array.from(removed);
        const queuePacks = buildReviewQueuePacks().filter((pack) => pack.packId);
        if (selected) {
          const nextPending = queuePacks.find((pack) => ['needs review', 'partially reviewed'].includes(String(pack.statusLabel || '').toLowerCase()));
          const fallback = nextPending || queuePacks[0] || null;
          if (fallback && fallback.packId !== safePackId) {
            state.selectedDraftPackId = fallback.packId;
            clearDraftScopedReviewUiState();
            await loadSelectedDraftReport();
          } else {
            state.reviewCompleted = true;
          }
        }
        setStatus(data?.message || 'Accepted draft copy removed from active drafts. Approved packs were not deleted.');
      } catch (error) {
        state.errors.push(`Remove accepted draft copy failed: ${error.message || 'Route error'}`);
        setStatus('Remove accepted draft copy failed.');
      }
      await refreshReviewQueueReports({ force: true, packIds: getReviewQueuePackIds() });
      render();
    }

    async function cleanupDraftPackFromReviewQueue(packId) {
      const safePackId = String(packId || '').trim();
      if (!safePackId) return;
      const selected = safePackId === state.selectedDraftPackId;
      try {
        const payload = await fetchJson(ENDPOINTS.draftReviewQueue(safePackId), {
          method: 'DELETE'
        });
        const data = unwrap(payload);
        if (data?.dashboard) state.dashboard = data.dashboard;
        if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        const removed = new Set(state.reviewQueueRemovedPackIds || []);
        removed.add(safePackId);
        state.reviewQueueRemovedPackIds = Array.from(removed);
        const queuePacks = buildReviewQueuePacks().filter((pack) => pack.packId);
        if (selected) {
          const nextPending = queuePacks.find((pack) => ['needs review', 'partially reviewed', 'reviewed', 'empty'].includes(String(pack.statusLabel || '').toLowerCase()));
          const fallback = nextPending || queuePacks[0] || null;
          if (fallback && fallback.packId !== safePackId) {
            state.selectedDraftPackId = fallback.packId;
            clearDraftScopedReviewUiState();
            await loadSelectedDraftReport();
          } else {
            state.reviewCompleted = true;
          }
        }
        setStatus(data?.message || 'Draft removed from the active review queue.');
      } catch (error) {
        state.errors.push(`Remove draft from review queue failed: ${error.message || 'Route error'}`);
        setStatus('Remove draft from review queue failed.');
      }
      await refreshReviewQueueReports({ force: true, packIds: getReviewQueuePackIds() });
      render();
    }

    function canOpenDoneTab() {
      return state.reviewCompleted || isCurrentSelectedDraftAccepted() || areAllReviewQueuePacksAccepted();
    }

    function cancelReviewWorkflow() {
      state.selectedReviewItemKeys = [];
      state.selectedReviewItem = null;
      state.activeFixItem = null;
      state.selectedReviewEvidenceItem = null;
      state.selectedReviewItemKeys = [];
      state.reviewBulkMessage = '';
      state.reviewBulkMessage = 'Review canceled. Uploaded source files and draft packs were left untouched.';
      state.reviewCompleted = false;
      state.activeTab = 'upload';
      setStatus('Review canceled. Uploads and drafts were preserved.');
      render();
    }

    async function rejectBlockingItemsAndPromote() {
      if (!state.selectedDraftPackId || state.reviewActionLoading || state.promotionActionLoading) return;
      const draftPackIdAtStart = state.selectedDraftPackId;
      const visibleItems = getVisibleReviewItemsForPack(state.selectedDraftPackId);
      const blockers = getPromotionBlockingReviewItems(visibleItems);
      const pendingRows = visibleItems.filter((item) => isPendingReviewStatus(getItemReviewWorkflowStatus(item)));
      const promotableApprovedCount = getPromotableApprovedReviewItemCount();
      if (pendingRows.length > 0 || promotableApprovedCount === 0) {
        if (promotableApprovedCount === 0) {
          state.reviewBulkMessage = 'No valid reviewed items are available to approve.';
        } else {
          state.reviewBulkMessage = 'Approve Reviewed Valid Items is available after pending items are accepted or rejected and at least one valid reviewed item can be promoted.';
        }
        setStatus(state.reviewBulkMessage);
        render();
        return;
      }

      if (blockers.length > 0) {
        const confirmed = window.confirm(
          `Approve reviewed valid items only? ${blockers.length} flagged item${blockers.length === 1 ? '' : 's'} will be excluded and will not be included in the approved pack.`
        );
        if (!confirmed) return;
      }

      state.reviewActionLoading = true;
      state.promotionActionLoading = true;
      state.errors = [];
      state.reviewBulkMessage = blockers.length > 0
        ? `Excluding ${formatNumber(blockers.length)} flagged item${blockers.length === 1 ? '' : 's'} before approval.`
        : 'Creating approved pack from reviewed valid items...';
      setStatus(blockers.length > 0 ? 'Excluding flagged draft items...' : 'Creating approved pack...');
      render();

      let latestReport = null;
      const failed = [];
      try {
        for (const item of blockers) {
          try {
            const payload = await fetchJson(ENDPOINTS.draftItemStatus(draftPackIdAtStart, item.section, item.index), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                reviewStatus: 'rejected',
                itemRef: buildReviewItemRef(item)
              })
            });
            const data = unwrap(payload);
            latestReport = data?.report || latestReport;
          } catch (error) {
            failed.push(`${SECTION_LABELS[item.section] || item.section} item ${item.index}: ${error.message || 'Route error'}`);
          }
        }

        if (latestReport) state.report = latestReport;
        await refreshDraftLists();
        state.selectedReviewItemKeys = [];
        reconcileSelectedReviewItem();

        if (failed.length) {
          state.errors.push(...failed);
          state.reviewBulkMessage = `Some flagged items could not be excluded. ${formatPromotionFailureMessage(state.report?.promotionReadiness, visibleItems)}`;
          setStatus('Approval is still blocked.');
          return;
        }

        const promotion = await requestDraftPromotion(draftPackIdAtStart, { force: false });
        if (!promotion.success) {
          state.errors.push(...promotion.errors);
          if (Array.isArray(promotion.promotionReadiness?.blockedReasons)) {
            state.errors.push(...promotion.promotionReadiness.blockedReasons);
          }
          state.reviewBulkMessage = formatPromotionFailureMessage(promotion.promotionReadiness || state.report?.promotionReadiness, visibleItems);
          state.promotionMessage = 'Approval blocked';
          await loadSelectedDraftReport();
          setStatus(state.reviewBulkMessage);
          return;
        }

        const data = promotion.data || {};
        const approvedPack = data.approved || data.approvedSummary?.approvedPacks?.find((pack) => String(pack?.packId || '').trim() === String(data.packId || draftPackIdAtStart || '').trim()) || {};
        const approvedName = approvedPack.title || approvedPack.packId || data.packId || draftPackIdAtStart || 'Approved knowledge pack';
        const approvedCount = getDraftItemCount(approvedPack);
        state.promotionMessage = 'Saved and enabled for student answers.';
        state.reviewBulkMessage = `Saved and enabled for student answers: "${approvedName}"${approvedCount ? ` (${formatNumber(approvedCount)} item${approvedCount === 1 ? '' : 's'})` : ''}. View it in Saved Knowledge Packs.`;
        if (data?.dashboard) state.dashboard = data.dashboard;
        if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
        state.report = data && Object.prototype.hasOwnProperty.call(data, 'report') ? data.report : state.report;
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        await refreshTeacherContentSummaries();
        state.reviewCompleted = true;
        state.activeTab = 'complete';
        setStatus(state.reviewBulkMessage);
      } catch (error) {
        state.errors.push(`Approve valid items only failed: ${error.message || 'Route error'}`);
        state.reviewBulkMessage = formatPromotionFailureMessage(state.report?.promotionReadiness, visibleItems);
        await loadSelectedDraftReport();
      } finally {
        state.reviewActionLoading = false;
        state.promotionActionLoading = false;
        render();
      }
    }

    async function promoteSelectedDraft() {
      const draft = state.report?.draftPack || getSelectedDraftSummary();
      const summary = getReviewProgressSummary(draft);
      if (!state.selectedDraftPackId || state.promotionActionLoading || !canCreateApprovedPackFromCurrentReport(summary)) return;
      const importScope = getDraftImportScope(draft);

      if (importScope.sampleOnly || importScope.rangeLimited) {
        const scopeConfirmed = window.confirm(
          `${importScope.warning || `This draft only covers ${importScope.rangeLabel || 'a limited range'}. Run Full Import to process the whole document.`}\n\nPromote this ${importScope.sampleOnly ? 'sample-only' : 'range-limited'} draft anyway?`
        );
        if (!scopeConfirmed) return;
      }

      const confirmed = window.confirm(
        'This will create an approved knowledge pack from valid items only, archive this draft from Saved Knowledge Packs, and make the approved pack live for student answers.'
      );
      if (!confirmed) return;

      state.promotionActionLoading = true;
      state.promotionMessage = '';
      state.errors = [];
      setStatus('Approving draft knowledge pack...');
      render();

      try {
      const promotion = await requestDraftPromotion(state.selectedDraftPackId, {
        force: false,
        promotionMode: 'approvedOnly'
      });
        if (!promotion.success) {
          state.errors.push(...promotion.errors);
          if (Array.isArray(promotion.promotionReadiness?.blockedReasons)) {
            state.errors.push(...promotion.promotionReadiness.blockedReasons);
          }
          state.promotionMessage = 'Approval blocked';
          state.reviewBulkMessage = formatPromotionFailureMessage(
            promotion.promotionReadiness || state.report?.promotionReadiness,
            getVisibleReviewItemsForPack(state.selectedDraftPackId)
          );
          await loadSelectedDraftReport();
          return;
        }
        const data = promotion.data || {};
        const approvedPack = data.approved || data.approvedSummary?.approvedPacks?.find((pack) => String(pack?.packId || '').trim() === String(data.packId || state.selectedDraftPackId || '').trim()) || {};
        const approvedName = approvedPack.title || approvedPack.packId || data.packId || draft?.title || 'Approved knowledge pack';
        const approvedCount = getDraftItemCount(approvedPack);
        state.promotionMessage = 'Saved and enabled for student answers.';
        if (data?.dashboard) state.dashboard = data.dashboard;
        if (Array.isArray(data?.drafts)) state.drafts = data.drafts;
        const archivedPackIds = new Set((Array.isArray(data?.archivedDrafts) ? data.archivedDrafts : []).map((entry) => String(entry?.packId || '').trim()).filter(Boolean));
        state.selectedReviewItemKeys = [];
        if (state.selectedDraftPackId && archivedPackIds.has(state.selectedDraftPackId)) {
          state.selectedDraftPackId = '';
          state.report = null;
        } else {
          state.report = data && Object.prototype.hasOwnProperty.call(data, 'report') ? data.report : state.report;
        }
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        await refreshTeacherContentSummaries();
        state.reviewCompleted = true;
        focusKnowledgeManager(`Saved and enabled for student answers: "${approvedName}"${approvedCount ? ` (${formatNumber(approvedCount)} item${approvedCount === 1 ? '' : 's'})` : ''}. View it in Saved Knowledge Packs.`);
      } catch (error) {
        const routeErrors = Array.isArray(error.errors) && error.errors.length ? error.errors : [error.message || 'Route error'];
        state.errors.push(...routeErrors);
        state.promotionMessage = 'Approval blocked';
        await loadSelectedDraftReport();
      } finally {
        state.promotionActionLoading = false;
        render();
      }
    }

    async function requestDraftPromotion(packId, options = {}) {
      const safePackId = String(packId || '').trim();
      if (!safePackId) {
        return {
          success: false,
          errors: ['A draft pack must be selected before approval.'],
          data: null
        };
      }
      try {
        const payload = await fetchJson(ENDPOINTS.approveCombinedReview, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'final_publish',
            draftPackId: safePackId
          })
        });
        return {
          success: true,
          errors: [],
          data: unwrap(payload)
        };
      } catch (error) {
        return {
          success: false,
          errors: Array.isArray(error?.errors) && error.errors.length
            ? error.errors
            : [error?.message || 'Draft approval failed.'],
          promotionReadiness: error?.data && typeof error.data === 'object' && error.data.promotionReadiness
            ? error.data.promotionReadiness
            : null,
          data: null
        };
      }
    }

    function hasApprovedPackExistsConflict(promotion) {
      const errors = Array.isArray(promotion?.errors) ? promotion.errors : [];
      const combined = errors.map((entry) => String(entry || '')).join(' ').toLowerCase();
      return combined.includes('approved pack already exists')
        || (combined.includes('force') && combined.includes('overwrite'));
    }

    return {
      selectReviewQueuePack,
      removeDraftPackFromReviewQueue,
      cleanupDraftPackFromReviewQueue,
      canOpenDoneTab,
      cancelReviewWorkflow,
      rejectBlockingItemsAndPromote,
      promoteSelectedDraft,
      requestDraftPromotion,
      hasApprovedPackExistsConflict
    };
  }

  ns.createReviewControllerModule = createReviewControllerModule;
})();
