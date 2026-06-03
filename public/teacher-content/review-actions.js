(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createReviewActionsModule(deps = {}) {
    const {
      state,
      render,
      setStatus,
      fetchJson,
      ENDPOINTS,
      unwrap,
      SECTION_LABELS,
      getFilteredReviewItems,
      getVisibleReviewItems,
      getVisibleReviewItemsForPack,
      reviewItemKeyForItem,
      reviewItemKey,
      isReviewItemReadyForPack,
      isReviewItemSelectableForAcceptSelected,
      getSelectedReviewItems,
      isReviewItemBlockingPromotion,
      getPromotionBlockingReviewItems,
      getAcceptSelectedBlockersForItem,
      getPromotableApprovedReviewItemCount,
      formatNumber,
      buildReviewItemRef,
      formatEditableFieldValue,
      getItemReviewWorkflowStatus,
      getReviewEditableFieldValue,
      getReviewItemPromotionBlockers,
      makePostEditSaveMessage,
      clearDraftScopedReviewUiState,
      loadSelectedDraftReport,
      refreshReviewQueueReports,
      getReviewQueuePackIds,
      findReviewItemFromButton,
      isReviewFilterMatch,
      makeActiveFixItem,
      buildReviewItemRefFromButton,
      scrollFocusedFixViewIntoView,
      findPendingItemByKey,
      refreshDraftLists,
      reconcileSelectedReviewItem,
      findReviewItem,
      getActiveFixReviewItem,
      appendReviewDebugEvent,
      getReviewItemPrimaryLabel,
      refreshSelectedDraftReportFromBackend,
      setReviewInlineMessage,
      isReviewConflictError,
      refreshFocusedReviewItemAfterConflict,
      refreshFocusedReviewItemState,
      formatReviewBlockerSummary,
      applyApprovedSummary,
      refreshTeacherContentSummaries,
      focusKnowledgeManager,
      buildReviewQueuePacks,
      window
    } = deps;

    function escapeSelectorValue(value) {
        return String(value || '').replace(/["\\]/g, '\\$&');
      }

    function captureReviewScrollSnapshot() {
        const overlay = document.querySelector('#teacherContentOverlay');
        const activeCard = document.querySelector('.teacher-content-card.active');
        const tableBody = document.querySelector('.teacher-content-review-table-body');
        return {
          windowY: window.scrollY || 0,
          overlayScrollTop: overlay ? overlay.scrollTop : null,
          activeCardScrollTop: activeCard ? activeCard.scrollTop : null,
          tableBodyScrollTop: tableBody ? tableBody.scrollTop : null
        };
      }

    function restoreReviewScrollSnapshot(snapshot = {}) {
        requestAnimationFrame(() => {
          const overlay = document.querySelector('#teacherContentOverlay');
          const activeCard = document.querySelector('.teacher-content-card.active');
          const tableBody = document.querySelector('.teacher-content-review-table-body');
          if (typeof snapshot.overlayScrollTop === 'number' && overlay) overlay.scrollTop = snapshot.overlayScrollTop;
          if (typeof snapshot.activeCardScrollTop === 'number' && activeCard) activeCard.scrollTop = snapshot.activeCardScrollTop;
          if (typeof snapshot.tableBodyScrollTop === 'number' && tableBody) tableBody.scrollTop = snapshot.tableBodyScrollTop;
          if (typeof snapshot.windowY === 'number') {
            window.scrollTo({ top: snapshot.windowY, left: 0, behavior: 'auto' });
          }
        });
      }

    function renderPreservingReviewScroll(options = {}) {
        const snapshot = captureReviewScrollSnapshot();
        const focusItemKey = String(options.focusItemKey || '').trim();
        render();
        restoreReviewScrollSnapshot(snapshot);
        if (!focusItemKey) return;
        requestAnimationFrame(() => {
          const selector = `[data-review-selection-item-key="${escapeSelectorValue(focusItemKey)}"]`;
          const nextCheckbox = document.querySelector(selector);
          if (nextCheckbox && typeof nextCheckbox.focus === 'function') {
            nextCheckbox.focus({ preventScroll: true });
          }
        });
      }

    function summarizeAcceptSelectedBlockers(items) {
        const list = Array.isArray(items) ? items : [];
        if (!list.length) return '';
        const messages = list.slice(0, 3).map((item) => {
          const label = getReviewItemPrimaryLabel(item);
          const blockers = getAcceptSelectedBlockersForItem(item);
          return `${label}: ${blockers.join('; ')}`;
        });
        const extra = list.length - messages.length;
        if (extra > 0) messages.push(`${formatNumber(extra)} more selected row${extra === 1 ? '' : 's'} blocked.`);
        return messages.join(' | ');
      }

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
        renderPreservingReviewScroll();
      }
    
    function clearReviewSelection() {
        if (!state.selectedReviewItemKeys.length) return;
        state.selectedReviewItemKeys = [];
        state.reviewBulkMessage = '';
        renderPreservingReviewScroll();
      }
    
    async function openReviewItem(button) {
        await openFocusedReviewItemFixFromButton(button);
      }
    
    async function openReviewItemEditorFromButton(button) {
        await openFocusedReviewItemFixFromButton(button);
      }
    
    async function openFocusedReviewItemFixFromButton(button) {
        if (!button) return;
        const targetDraftPackId = String(button.getAttribute('data-draft-pack-id') || state.selectedDraftPackId || '').trim();
        if (targetDraftPackId && targetDraftPackId !== state.selectedDraftPackId) {
          state.selectedDraftPackId = targetDraftPackId;
          clearDraftScopedReviewUiState();
          await loadSelectedDraftReport();
          await refreshReviewQueueReports({ packIds: getReviewQueuePackIds() });
        }
        const item = findReviewItemFromButton(button, targetDraftPackId);
        if (!item) {
          state.errors.push('Could not find this item. Try switching to All.');
          render();
          return;
        }
        const isVisibleInCurrentFilter = isReviewFilterMatch(item, state.reviewListFilter);
        if (!isVisibleInCurrentFilter) {
          state.reviewListFilter = 'all';
        }
        state.activeFixItem = makeActiveFixItem(item, {
          draftId: targetDraftPackId || item.draftPackId || state.selectedDraftPackId,
          itemRef: buildReviewItemRefFromButton(button) || buildReviewItemRef(item)
        });
        state.selectedReviewItem = null;
        state.selectedReviewEvidenceItem = null;
        state.reviewBulkMessage = '';
        render();
        scrollFocusedFixViewIntoView();
      }
    
    function updateReviewSelection(checkbox) {
        const itemKey = checkbox.getAttribute('data-review-selection-item-key')
          || reviewItemKey(
            checkbox.dataset.draftPackId || state.selectedDraftPackId,
            checkbox.dataset.section,
            Number(checkbox.dataset.index)
          );
        if (!itemKey) return;
    
        const selected = new Set(state.selectedReviewItemKeys);
        if (checkbox.checked) {
          selected.add(itemKey);
        } else {
          selected.delete(itemKey);
        }
        state.selectedReviewItemKeys = Array.from(selected);
        state.reviewBulkMessage = '';
        renderPreservingReviewScroll({ focusItemKey: itemKey });
      }
    
    async function acceptSelectedReviewItems() {
        const visible = getFilteredReviewItems(getVisibleReviewItems());
        const selected = visible.filter((item) => state.selectedReviewItemKeys.includes(reviewItemKeyForItem(item)));
        const readyItems = selected.filter(isReviewItemSelectableForAcceptSelected);
        const blockedItems = selected.filter((item) => !isReviewItemSelectableForAcceptSelected(item));
        if (!readyItems.length) {
          const blockedDetails = summarizeAcceptSelectedBlockers(blockedItems);
          state.reviewBulkMessage = selected.length
            ? `Accept Selected is blocked by selected rows: ${blockedDetails || 'selected rows still need edits or exclusion.'}`
            : 'No rows are selected for Accept Selected.';
          setStatus(state.reviewBulkMessage);
          render();
          return;
        }
    
        const confirmed = window.confirm(
          `Accept ${formatNumber(readyItems.length)} selected valid row${readyItems.length === 1 ? '' : 's'} into one combined knowledge pack?`
        );
        if (!confirmed) return;

        await acceptReviewItems(readyItems, {
          actionLabel: 'Accept Selected',
          mode: 'selected',
          skipped: blockedItems.length,
          doneMessage: `Accepted ${formatNumber(readyItems.length)} selected valid row${readyItems.length === 1 ? '' : 's'} into one combined knowledge pack.`
        });
      }

    function explainDisabledAcceptSelected() {
        const visible = getFilteredReviewItems(getVisibleReviewItems());
        const selected = visible.filter((item) => state.selectedReviewItemKeys.includes(reviewItemKeyForItem(item)));
        const readyItems = selected.filter(isReviewItemSelectableForAcceptSelected);
        if (readyItems.length > 0) return;
        const blockedItems = selected.filter((item) => !isReviewItemSelectableForAcceptSelected(item));
        const blockedDetails = summarizeAcceptSelectedBlockers(blockedItems);
        state.reviewBulkMessage = selected.length
          ? `Accept Selected is unavailable. Blocking selected rows: ${blockedDetails || 'selected rows still need edits or exclusion.'}`
          : 'Select at least one valid row before using Accept Selected.';
        setStatus(state.reviewBulkMessage);
        render();
      }
    
    async function excludeSelectedFlaggedReviewItems() {
        if (!state.selectedDraftPackId || state.reviewActionLoading || state.promotionActionLoading) return;
        const draftPackIdAtStart = state.selectedDraftPackId;
        const selected = getSelectedReviewItems();
        const blockers = selected.filter(isReviewItemBlockingPromotion);
        if (!blockers.length) {
          state.reviewBulkMessage = 'Select at least one flagged blocking item, then click Exclude Selected Flagged Items.';
          setStatus(state.reviewBulkMessage);
          render();
          return;
        }
    
        const confirmed = window.confirm(
          `Exclude ${blockers.length} selected flagged item${blockers.length === 1 ? '' : 's'} from this draft? These items will stay out of the approved pack.`
        );
        if (!confirmed) return;
    
        state.reviewActionLoading = true;
        state.errors = [];
        state.reviewBulkMessage = `Excluding ${formatNumber(blockers.length)} selected flagged item${blockers.length === 1 ? '' : 's'}...`;
        setStatus('Excluding selected flagged draft items...');
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
          state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => {
            const item = findPendingItemByKey(key);
            return item && !blockers.some((blockedItem) => reviewItemKeyForItem(blockedItem) === key);
          });
          reconcileSelectedReviewItem();
    
          if (failed.length) {
            state.errors.push(...failed);
            state.reviewBulkMessage = 'Some selected flagged items could not be excluded. Resolve remaining blockers and try again.';
            setStatus('Excluding selected flagged items failed for some rows.');
            return;
          }
    
          const remainingBlockers = getPromotionBlockingReviewItems(getVisibleReviewItemsForPack(state.selectedDraftPackId)).length;
          if (remainingBlockers > 0) {
            state.reviewBulkMessage = `Excluded ${formatNumber(blockers.length)} selected flagged item${blockers.length === 1 ? '' : 's'}. ${formatNumber(remainingBlockers)} flagged item${remainingBlockers === 1 ? '' : 's'} still need${remainingBlockers === 1 ? 's' : ''} exclusion before approval.`;
          } else if (getPromotableApprovedReviewItemCount() > 0) {
            state.reviewBulkMessage = `Excluded ${formatNumber(blockers.length)} selected flagged item${blockers.length === 1 ? '' : 's'}. Valid reviewed items are now ready to approve.`;
          } else {
            state.reviewBulkMessage = `Excluded ${formatNumber(blockers.length)} selected flagged item${blockers.length === 1 ? '' : 's'}. No valid reviewed items are available to approve.`;
          }
          setStatus('Selected flagged items were excluded.');
        } catch (error) {
          state.errors.push(`Exclude selected flagged items failed: ${error.message || 'Route error'}`);
          state.reviewBulkMessage = 'Exclude selected flagged items failed.';
          setStatus('Exclude selected flagged items failed.');
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }
    
    async function excludeSelectedReviewItems() {
        if (state.reviewActionLoading || state.promotionActionLoading) return;
        const selected = getSelectedReviewItems();
        if (!selected.length) {
          state.reviewBulkMessage = 'Select at least one row to exclude from the review queue.';
          setStatus(state.reviewBulkMessage);
          render();
          return;
        }
    
        state.reviewActionLoading = true;
        state.errors = [];
        state.reviewBulkMessage = `Excluding ${formatNumber(selected.length)} selected row${selected.length === 1 ? '' : 's'}...`;
        setStatus('Excluding selected draft rows...');
        render();
    
        let latestReport = null;
        const failed = [];
        let excluded = 0;
        try {
          for (const item of selected) {
            try {
              const draftPackId = String(item?.draftPackId || state.selectedDraftPackId || '').trim();
              if (!draftPackId) {
                failed.push(`${SECTION_LABELS[item.section] || item.section} item ${item.index}: missing draft pack id`);
                continue;
              }
              const payload = await fetchJson(ENDPOINTS.draftItemStatus(draftPackId, item.section, item.index), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  reviewStatus: 'rejected',
                  itemRef: buildReviewItemRef(item)
                })
              });
              const data = unwrap(payload);
              if (data?.report && draftPackId === state.selectedDraftPackId) {
                latestReport = data.report;
              }
              if (data?.report) {
                state.reviewReportsByPackId = {
                  ...(state.reviewReportsByPackId || {}),
                  [draftPackId]: data.report
                };
              }
              excluded += 1;
            } catch (error) {
              failed.push(`${SECTION_LABELS[item.section] || item.section} item ${item.index}: ${error.message || 'Route error'}`);
            }
          }
    
          if (latestReport) state.report = latestReport;
          await refreshDraftLists();
          await refreshReviewQueueReports({ force: true, packIds: getReviewQueuePackIds() });
          state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => {
            const item = findPendingItemByKey(key);
            return item && !selected.some((excludedItem) => reviewItemKeyForItem(excludedItem) === key);
          });
          reconcileSelectedReviewItem();
    
          if (failed.length) {
            state.errors.push(...failed);
          }
          state.reviewBulkMessage = failed.length
            ? `Excluded ${formatNumber(excluded)} selected row${excluded === 1 ? '' : 's'}. ${formatNumber(failed.length)} row${failed.length === 1 ? '' : 's'} failed to exclude.`
            : `Excluded ${formatNumber(excluded)} selected row${excluded === 1 ? '' : 's'} from the review queue.`;
          setStatus(state.reviewBulkMessage);
        } catch (error) {
          state.errors.push(`Exclude selected failed: ${error.message || 'Route error'}`);
          state.reviewBulkMessage = 'Exclude selected failed.';
          setStatus(state.reviewBulkMessage);
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }
    
    async function acceptAllReviewItems() {
        const draftPackId = String(state.selectedDraftPackId || '').trim();
        if (!draftPackId) {
          state.reviewBulkMessage = 'Select a draft pack before publishing the current draft.';
          setStatus(state.reviewBulkMessage);
          render();
          return;
        }

        const confirmed = window.confirm(
          'Publish this draft now? All structurally usable rows will be included in one combined knowledge pack.'
        );
        if (!confirmed) return;

        await acceptReviewItems([], {
          actionLabel: 'Accept All Valid',
          mode: 'final_publish',
          draftPackId,
          doneMessage: 'Published the current draft into one combined knowledge pack.'
        });
      }
    
    async function acceptReviewItems(items, options = {}) {
        if (state.reviewActionLoading) return;
        const mode = options.mode || 'selected';
        const finalPublish = mode === 'final_publish';
        const readyItems = finalPublish
          ? []
          : (Array.isArray(items) ? items : []).filter(isReviewItemSelectableForAcceptSelected);
        if (!finalPublish && !readyItems.length) return;
        state.reviewActionLoading = true;
        state.errors = [];
        state.reviewBulkMessage = finalPublish
          ? `${options.actionLabel || 'Accept'} is publishing the current draft into one combined knowledge pack.`
          : `${options.actionLabel || 'Accept'} is saving valid rows into one combined knowledge pack.`;
        setStatus(finalPublish
          ? 'Publishing current draft...'
          : 'Saving rows into one combined knowledge pack...');
        render();
    
        try {
          const combinedApproval = await requestCombinedReviewApproval(readyItems, {
            mode,
            draftPackId: options.draftPackId
          });
          if (!combinedApproval.success) {
            state.errors.push(...combinedApproval.errors);
            const skipped = Number(combinedApproval.skipped?.blocked || 0) + Number(combinedApproval.skipped?.stale || 0);
            state.reviewBulkMessage = finalPublish
              ? `${options.actionLabel || 'Accept'} failed.`
              : skipped > 0
              ? `${options.actionLabel || 'Accept'} skipped ${formatNumber(skipped)} row${skipped === 1 ? '' : 's'} that are stale or still blocked.`
              : `${options.actionLabel || 'Accept'} failed.`;
            setStatus(state.reviewBulkMessage);
            return;
          }
    
          const data = combinedApproval.data || {};
          const archivedPackIds = new Set((Array.isArray(data.archivedDrafts) ? data.archivedDrafts : []).map((entry) => String(entry?.packId || '').trim()).filter(Boolean));
          const publishedDraftPackId = String(options.draftPackId || state.selectedDraftPackId || '').trim();
          if (data.dashboard) state.dashboard = data.dashboard;
          if (Array.isArray(data.drafts)) {
            state.drafts = data.drafts;
            if (finalPublish && publishedDraftPackId && archivedPackIds.has(publishedDraftPackId)) {
              state.selectedDraftPackId = '';
              state.report = null;
            } else if (state.selectedDraftPackId && !state.drafts.some((draft) => String(draft?.packId || '') === String(state.selectedDraftPackId || ''))) {
              state.selectedDraftPackId = state.drafts[0]?.packId || '';
              if (!state.selectedDraftPackId) state.report = null;
            }
          } else if (finalPublish && publishedDraftPackId && archivedPackIds.has(publishedDraftPackId)) {
            state.selectedDraftPackId = '';
            state.report = null;
          }
          if (data.approvedSummary) applyApprovedSummary(data.approvedSummary);
          if (data.reportsByPackId && typeof data.reportsByPackId === 'object') {
            state.reviewReportsByPackId = {
              ...(state.reviewReportsByPackId || {}),
              ...data.reportsByPackId
            };
          }
          await refreshTeacherContentSummaries();
          await refreshReviewQueueReports({ force: true, packIds: getReviewQueuePackIds() });
          reconcileSelectedReviewItem();
          state.selectedReviewItemKeys = [];
          const combinedName = String(data.combinedPack?.title || data.combinedPack?.packId || 'Combined knowledge pack');
          const acceptedCount = Number(data.acceptedCount || readyItems.length);
          const skipped = Number(options.skipped || 0);
          const skippedText = skipped > 0
            ? ` ${formatNumber(skipped)} selected row${skipped === 1 ? '' : 's'} were skipped because they are invalid, blocked, or excluded.`
            : '';
          state.reviewBulkMessage = `Saved and enabled for student answers: "${combinedName}" (${formatNumber(acceptedCount)} item${acceptedCount === 1 ? '' : 's'}).${skippedText} View it in Saved Knowledge Packs.`;
          state.promotionMessage = 'Saved and enabled for student answers.';
          state.reviewCompleted = true;
          setStatus(state.reviewBulkMessage);
          focusKnowledgeManager(state.reviewBulkMessage);
        } catch (error) {
          state.errors.push(`${options.actionLabel || 'Accept'} failed: ${error.message || 'Route error'}`);
          state.reviewBulkMessage = `${options.actionLabel || 'Accept'} failed before the combined knowledge pack was saved.`;
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }
    
    async function requestCombinedReviewApproval(items, options = {}) {
        const mode = options.mode || 'selected';
        if (mode === 'final_publish') {
          const safeDraftPackId = String(options.draftPackId || state.selectedDraftPackId || '').trim();
          if (!safeDraftPackId) {
            return {
              success: false,
              errors: ['A draft pack must be selected before final publish.'],
              skipped: null,
              data: null
            };
          }
          try {
            const payload = await fetchJson(ENDPOINTS.approveCombinedReview, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: 'final_publish',
                draftPackId: safeDraftPackId
              })
            });
            return {
              success: true,
              errors: [],
              skipped: null,
              data: unwrap(payload)
            };
          } catch (error) {
            return {
              success: false,
              errors: Array.isArray(error?.errors) && error.errors.length
                ? error.errors
                : [error?.message || 'Combined approval failed.'],
              skipped: error?.data?.skipped || null,
              data: null
            };
          }
        }
        const rows = (Array.isArray(items) ? items : []).map((item) => ({
          draftPackId: String(item?.draftPackId || '').trim(),
          section: String(item?.section || '').trim(),
          index: Number(item?.index),
          sourcePackName: String(item?.sourcePackName || '').trim(),
          itemRef: buildReviewItemRef(item)
        })).filter((row) => row.draftPackId && row.section && Number.isInteger(row.index) && row.index >= 0);
        if (!rows.length) {
          return {
            success: false,
            errors: ['No valid rows were provided for combined approval.'],
            skipped: null,
            data: null
          };
        }
        try {
          const payload = await fetchJson(ENDPOINTS.approveCombinedReview, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode,
              reviewBatchName: resolveCombinedReviewBatchName(),
              reviewBatchPackIds: getReviewQueuePackIds(),
              rows
            })
          });
          return {
            success: true,
            errors: [],
            skipped: null,
            data: unwrap(payload)
          };
        } catch (error) {
          return {
            success: false,
            errors: Array.isArray(error?.errors) && error.errors.length
              ? error.errors
              : [error?.message || 'Combined approval failed.'],
            skipped: error?.data?.skipped || null,
            data: null
          };
        }
      }
    
    function resolveCombinedReviewBatchName() {
        const explicit = String(state.uploadContentName || '').trim();
        if (explicit) return explicit;
        const queueTitles = Array.from(new Set(
          buildReviewQueuePacks()
            .map((pack) => String(pack?.title || '').trim())
            .filter(Boolean)
        ));
        if (queueTitles.length === 1) return queueTitles[0];
        return '';
      }
    
    function closeReviewItem() {
        state.selectedReviewItem = null;
        state.activeFixItem = null;
        render();
      }
    
    function openReviewEvidence(button) {
        const item = findReviewItem(
          button.dataset.section,
          Number(button.dataset.index),
          button.dataset.draftPackId || state.selectedDraftPackId
        );
        if (!item) {
          state.errors.push('Review item evidence is no longer available. Refresh the draft report.');
          render();
          return;
        }
    
        state.selectedReviewEvidenceItem = item;
        state.selectedReviewItem = null;
        state.activeFixItem = null;
        render();
      }
    
    function closeReviewEvidence() {
        state.selectedReviewEvidenceItem = null;
        render();
      }
    
    async function updateReviewStatusFromButton(button) {
        const section = button.dataset.section;
        const index = Number(button.dataset.index);
        const reviewStatus = button.dataset.reviewStatus;
        const draftPackId = String(button?.dataset?.draftPackId || state.selectedDraftPackId || '').trim();
        if (draftPackId && draftPackId !== state.selectedDraftPackId) {
          state.selectedDraftPackId = draftPackId;
          clearDraftScopedReviewUiState();
          await loadSelectedDraftReport();
          await refreshReviewQueueReports({ packIds: getReviewQueuePackIds() });
        }
        const detailPanel = button.closest('[data-review-detail]');
        const focusedPanel = button.closest('[data-review-focused-fix]');
        const selected = state.selectedReviewItem;
        const matchedItem = findReviewItemFromButton(button, draftPackId)
          || findReviewItem(section, index, draftPackId)
          || getActiveFixReviewItem()
          || selected
          || null;
        const buttonItemRef = buildReviewItemRefFromButton(button);
        const currentItemRef = buildReviewItemRef(matchedItem);
        const itemRef = (detailPanel || focusedPanel) && currentItemRef ? currentItemRef : buttonItemRef || currentItemRef;
        appendReviewDebugEvent('review-status-button-click', {
          section,
          index,
          reviewStatus,
          buttonText: String(button.textContent || '').trim(),
          hasDetailPanel: Boolean(detailPanel),
          hasFocusedPanel: Boolean(focusedPanel),
          selectedSection: selected?.section || '',
          selectedIndex: Number(selected?.index),
          itemRef
        });
    
        if (reviewStatus === 'approved' && (detailPanel || focusedPanel)) {
          const detailItem = matchedItem;
          await approveSelectedReviewItemWithCurrentEdits(detailItem, detailPanel || focusedPanel, {
            sourceAction: focusedPanel ? 'focused-fix-approve-button' : 'detail-approve-button',
            itemRef
          });
          return;
        }
    
        const patched = await patchReviewStatus(section, index, reviewStatus, {
          draftPackId,
          sourceAction: 'review-status-button',
          hasDetailPanel: Boolean(detailPanel),
          hasFocusedPanel: Boolean(focusedPanel),
          itemRef
        });
        if (patched && reviewStatus === 'rejected' && focusedPanel) {
          const label = getReviewItemPrimaryLabel(matchedItem);
          state.activeFixItem = null;
          state.selectedReviewItem = null;
          state.reviewBulkMessage = `Deleted from review list: ${label}`;
          setStatus(state.reviewBulkMessage);
          await refreshSelectedDraftReportFromBackend();
          render();
        }
      }
    
    async function patchReviewStatus(section, index, reviewStatus, debugContext = {}) {
        const draftPackId = String(debugContext.draftPackId || state.selectedDraftPackId || '').trim();
        if (!draftPackId || !section || !Number.isInteger(index)) return false;
        const currentItem = findReviewItem(section, index, draftPackId);
        const itemRef = debugContext.itemRef || buildReviewItemRef(currentItem);
        setReviewInlineMessage(section, index, '', draftPackId);
        appendReviewDebugEvent('patch-review-status-request', {
          draftPackId,
          section,
          index,
          reviewStatus,
          itemRef,
          ...debugContext
        });
        return mutateReviewDraft(
          ENDPOINTS.draftItemStatus(draftPackId, section, index),
          { reviewStatus, itemRef, debugContext },
          `Marked ${SECTION_LABELS[section] || section} item ${index} ${reviewStatus}.`,
          {
            item: currentItem,
            itemRef,
            conflictMessage: reviewStatus === 'approved'
              ? 'This item was refreshed. Try approving again.'
              : 'This item was refreshed. Try the action again.'
          }
        );
      }
    
    async function saveFocusedReviewItemEditsFromButton(button) {
        if (!state.selectedDraftPackId) return;
        const scope = button.closest('[data-review-focused-fix]') || document;
        let item = findReviewItemFromButton(button) || getActiveFixReviewItem();
        if (!item) {
          state.errors.push('Could not find this item after the latest refresh. Reopen it from the review list.');
          render();
          return;
        }
    
        const changed = collectReviewFieldEdits(item, scope);
        if (!changed.length) {
          const message = 'No changes to save.';
          setReviewInlineMessage(item.section, item.index, message);
          state.reviewBulkMessage = message;
          setStatus(message);
          render();
          return;
        }
    
        state.reviewActionLoading = true;
        state.errors = [];
        setStatus('Saving draft item edits...');
        render();
    
        let itemRef = buildReviewItemRef(item);
        let refreshedItem = item;
        try {
          for (const edit of changed) {
            const payload = await fetchJson(ENDPOINTS.draftItem(state.selectedDraftPackId, refreshedItem.section, refreshedItem.index), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                field: edit.field,
                value: edit.value,
                itemRef,
                debugContext: {
                  sourceAction: 'focused-fix-save-button',
                  changedFields: changed.map((entry) => entry.field),
                  draftPackId: state.selectedDraftPackId,
                  section: refreshedItem.section,
                  index: Number(refreshedItem.index),
                  itemId: refreshedItem.itemId || refreshedItem.term || refreshedItem.title || '',
                  itemRef
                }
              })
            });
            const data = unwrap(payload);
            if (data?.report) state.report = data.report;
            if (data?.debug) {
              appendReviewDebugEvent('focused-save-edits-response', data.debug);
            }
            const resolvedSection = String(data?.debug?.request?.section || refreshedItem.section || '').trim() || refreshedItem.section;
            const resolvedIndex = Number.isInteger(Number(data?.debug?.request?.index))
              ? Number(data.debug.request.index)
              : Number(refreshedItem.index);
            refreshedItem = refreshFocusedReviewItemState(
              findReviewItem(resolvedSection, resolvedIndex) || refreshedItem,
              itemRef
            ) || refreshedItem;
            itemRef = buildReviewItemRef(refreshedItem) || itemRef;
          }
    
          await refreshDraftLists();
          await refreshSelectedDraftReportFromBackend();
          refreshedItem = refreshFocusedReviewItemState(refreshedItem, itemRef) || refreshedItem;
          const message = makePostEditSaveMessage(refreshedItem, item);
          setReviewInlineMessage(item.section, item.index, '');
          setReviewInlineMessage(refreshedItem.section, refreshedItem.index, message);
          state.reviewBulkMessage = message;
          setStatus(message);
        } catch (error) {
          appendReviewDebugEvent('focused-save-edits-error', {
            draftPackId: state.selectedDraftPackId,
            section: item.section,
            index: item.index,
            errors: Array.isArray(error?.errors) ? error.errors : [error?.message || 'Route error'],
            changedFields: changed.map((entry) => entry.field),
            itemRef
          });
          if (isReviewConflictError(error)) {
            await refreshFocusedReviewItemAfterConflict(item, itemRef, 'This item was refreshed. Try saving again.');
          } else {
            const routeErrors = Array.isArray(error?.errors) && error.errors.length
              ? error.errors
              : [error?.message || 'Route error'];
            state.errors.push(...routeErrors);
            const message = `Save failed: ${formatReviewBlockerSummary(routeErrors) || 'Route error'}`;
            setReviewInlineMessage(item.section, item.index, message);
            state.reviewBulkMessage = message;
            setStatus(message);
          }
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }
    
    async function approveSelectedReviewItemWithCurrentEdits(item, scope, debugContext = {}) {
        if (!item || !state.selectedDraftPackId) return;
        const itemRef = debugContext.itemRef || buildReviewItemRef(item);
        setReviewInlineMessage(item.section, item.index, '');
        const changed = collectReviewFieldEdits(item, scope, { includeUnchanged: true });
        appendReviewDebugEvent('approve-selected-with-edits-request', {
          draftPackId: state.selectedDraftPackId,
          section: item.section,
          index: item.index,
          itemId: item.itemId || item.term || item.title || '',
          itemRef,
          changedFields: changed.map((entry) => entry.field),
          changedValues: changed,
          debugContext
        });
        state.reviewActionLoading = true;
        state.errors = [];
        setStatus('Saving and approving draft item...');
        render();
    
        try {
          const payload = await fetchJson(ENDPOINTS.draftItemStatus(state.selectedDraftPackId, item.section, item.index), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reviewStatus: 'approved',
              edits: changed,
              itemRef,
              debugContext: {
                ...debugContext,
                sourceAction: debugContext.sourceAction || 'approveSelectedReviewItemWithCurrentEdits',
                changedFields: changed.map((entry) => entry.field),
                draftPackId: state.selectedDraftPackId,
                section: item.section,
                index: Number(item.index),
                itemId: item.itemId || item.term || item.title || '',
                itemRef
              }
            })
          });
          const data = unwrap(payload);
          if (data?.report) state.report = data.report;
          if (data?.debug) {
            appendReviewDebugEvent('approve-selected-with-edits-response', data.debug);
          }
          await refreshDraftLists();
          await refreshSelectedDraftReportFromBackend();
          const resolvedSection = String(data?.debug?.request?.section || item.section || '').trim() || item.section;
          const resolvedIndex = Number.isInteger(Number(data?.debug?.request?.index))
            ? Number(data.debug.request.index)
            : Number(item.index);
          const refreshedItem = findReviewItem(resolvedSection, resolvedIndex) || findReviewItem(item.section, item.index);
          const refreshedStatus = getItemReviewWorkflowStatus(refreshedItem);
          const refreshedBlockers = getReviewItemPromotionBlockers(refreshedItem || { ...item, reviewStatus: 'approved' });
          const approvedLabel = getReviewItemPrimaryLabel(refreshedItem || item);
          if (refreshedStatus === 'approved' && refreshedBlockers.length === 0) {
            const approvedMessage = `Approved revised item: ${approvedLabel}`;
            setReviewInlineMessage(item.section, item.index, '');
            setReviewInlineMessage(resolvedSection, resolvedIndex, approvedMessage);
            state.reviewBulkMessage = approvedMessage;
            state.activeFixItem = null;
            state.selectedReviewItem = null;
            setStatus(approvedMessage);
          } else {
            const blockerSummary = refreshedBlockers.length
              ? formatReviewBlockerSummary(refreshedBlockers)
              : 'approval requirements were not met';
            const blockedMessage = `Still blocked: ${blockerSummary}`;
            setReviewInlineMessage(item.section, item.index, '');
            setReviewInlineMessage(resolvedSection, resolvedIndex, blockedMessage);
            state.activeFixItem = makeActiveFixItem(refreshedItem || item, {
              draftId: state.selectedDraftPackId,
              itemRef: buildReviewItemRef(refreshedItem || item) || itemRef
            });
            state.errors.push(blockedMessage);
            state.reviewBulkMessage = blockedMessage;
            setStatus(blockedMessage);
          }
        } catch (error) {
          const routeErrors = Array.isArray(error?.errors) && error.errors.length
            ? error.errors
            : [error?.message || 'Route error'];
          if (isReviewConflictError(error)) {
            appendReviewDebugEvent('approve-selected-with-edits-conflict-refresh', {
              draftPackId: state.selectedDraftPackId,
              section: item.section,
              index: item.index,
              errors: routeErrors,
              changedFields: changed.map((entry) => entry.field),
              itemRef
            });
            await refreshFocusedReviewItemAfterConflict(item, itemRef, 'This item was refreshed. Try approving again.');
            return;
          }
          const blockerSummary = formatReviewBlockerSummary(routeErrors);
          const blockedMessage = blockerSummary
            ? `Still blocked: ${blockerSummary}`
            : 'Still blocked: approval requirements were not met';
          setReviewInlineMessage(item.section, item.index, blockedMessage);
          state.activeFixItem = makeActiveFixItem(item, {
            draftId: state.selectedDraftPackId,
            itemRef
          });
          appendReviewDebugEvent('approve-selected-with-edits-error', {
            draftPackId: state.selectedDraftPackId,
            section: item.section,
            index: item.index,
            errors: routeErrors,
            changedFields: changed.map((entry) => entry.field),
            itemRef
          });
          state.errors.push(...routeErrors);
          state.reviewBulkMessage = blockedMessage;
          setStatus(blockedMessage);
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }
    
    function collectReviewFieldEdits(item, scope = document, options = {}) {
        if (!item || !scope) return [];
        const allowedFields = EDITABLE_FIELDS[item.section] || [];
        const changed = [];
        allowedFields.forEach((fieldName) => {
          const input = scope.querySelector(`[data-review-field="${fieldName}"]`);
          if (!input) return;
          const nextValue = String(input.value ?? '');
          const previousValue = formatEditableFieldValue(getReviewEditableFieldValue(item, fieldName));
          if (options.includeUnchanged || nextValue !== previousValue) {
            changed.push({
              field: fieldName,
              value: nextValue
            });
          }
        });
        return changed;
      }
    
    async function mutateReviewDraft(url, body, successMessage, conflictContext = {}) {
        state.reviewActionLoading = true;
        state.errors = [];
        setStatus('Saving draft review action...');
        render();
    
        try {
          const payload = await fetchJson(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const data = unwrap(payload);
          if (data?.report) state.report = data.report;
          if (data?.debug) {
            appendReviewDebugEvent('mutate-review-draft-response', data.debug);
          }
          await refreshDraftLists();
          reconcileSelectedReviewItem();
          setStatus(successMessage);
          return true;
        } catch (error) {
          if (isReviewConflictError(error) && conflictContext.item) {
            await refreshFocusedReviewItemAfterConflict(
              conflictContext.item,
              conflictContext.itemRef || body?.itemRef || null,
              conflictContext.conflictMessage || 'This item was refreshed. Try the action again.'
            );
            return false;
          }
          state.errors.push(`Draft review action failed: ${error.message || 'Route error'}`);
          return false;
        } finally {
          state.reviewActionLoading = false;
          render();
        }
      }

    return {
      toggleSelectAllVisibleReviewItems,
      clearReviewSelection,
      openReviewItem,
      openReviewItemEditorFromButton,
      openFocusedReviewItemFixFromButton,
      updateReviewSelection,
      acceptSelectedReviewItems,
      explainDisabledAcceptSelected,
      excludeSelectedFlaggedReviewItems,
      excludeSelectedReviewItems,
      acceptAllReviewItems,
      acceptReviewItems,
      requestCombinedReviewApproval,
      resolveCombinedReviewBatchName,
      closeReviewItem,
      openReviewEvidence,
      closeReviewEvidence,
      updateReviewStatusFromButton,
      patchReviewStatus,
      saveFocusedReviewItemEditsFromButton,
      approveSelectedReviewItemWithCurrentEdits,
      collectReviewFieldEdits,
      mutateReviewDraft
    };
  }

  ns.createReviewActionsModule = createReviewActionsModule;
})();
