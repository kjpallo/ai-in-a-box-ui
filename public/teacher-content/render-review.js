(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createRenderReviewModule(deps = {}) {
    const {
      state,
      escapeHtml,
      escapeAttr,
      formatNumber,
      SECTION_LABELS,
      REVIEW_PRIMARY_DRAFT_SECTIONS,
      EDITABLE_FIELDS,
      PAUSED_STANDARDS_WARNING_PATTERNS,
      render,
      setStatus,
      getReviewStateSnapshot,
      getReviewQueuePackIds,
      getSelectedDraftSummary,
      getReviewProgressSummary,
      getTotalPrimaryDraftItemCount,
      getActiveFixReviewItem,
      renderIssueList,
      isDraftPackApproved,
      canCreateApprovedPackFromCurrentReport,
      buildTeacherFriendlyFailedSections,
      countFailedAfterRetrySections,
      hasAnyPrimaryDraftItems,
      cardWithEmptyState,
      getVisibleReviewItems,
      reviewItemKeyForItem,
      isReviewItemReadyForPack,
      formatReviewItemStatusLabel,
      summarizeReviewItemActionNeeded,
      getReviewInlineMessage,
      getItemReviewWorkflowStatus,
      getReviewItemPromotionBlockers,
      renderReviewItemIdentityDataAttrs,
      getReviewItemPrimaryLabel,
      getDraftTitleForPackId,
      renderCoverageReport,
      metric,
      getReviewIssueBlockersForItem,
      titleCase,
      formatConfidence,
      findPendingItemByKey,
      selectedReviewItemsHaveBlockers,
      isReviewItemSelectableForAcceptSelected,
      getAcceptSelectedBlockersForItem,
      hasMissingRequiredReviewFields,
      isItemNeedingTeacherReview
    } = deps;

    function renderReviewCard() {
        if (!state.selectedDraftPackId) {
          return cardWithEmptyState('Review Knowledge Packet', 'No draft pack is selected yet. Choose a draft pack before reviewing items.');
        }
    
        if (state.reviewActionLoading) {
          return `
            <div class="teacher-content-card-head">
              <div>
                <h4>Review Knowledge Packet</h4>
                <p>Saving draft-only review change...</p>
              </div>
              <span class="teacher-content-pill review">Saving</span>
            </div>
            <p class="profile-empty-state">Refreshing the selected review list.</p>
          `;
        }
    
        const reviewState = getReviewStateSnapshot();
        const allItems = reviewState.reviewableItems;
        const filteredItems = getSortedReviewItems(reviewState.filteredReviewableItems);
        const queuePackIds = getReviewQueuePackIds();
        const sourceCount = queuePackIds.length;
        const draft = state.report?.draftPack || getSelectedDraftSummary();
        const summary = getReviewProgressSummary(draft);
        const totalReviewableCount = getTotalPrimaryDraftItemCount(draft);
        const needsReviewCount = allItems.length;
        const reviewSummaryLine = renderReviewSummaryLine({
          sourceCount,
          candidateCount: allItems.length,
          visibleCount: filteredItems.length
        });
        const hasActiveFixItem = Boolean(state.activeFixItem);
        const activeFixItem = hasActiveFixItem ? getActiveFixReviewItem() : null;
        const isEditingReviewItem = hasActiveFixItem;
        if (hasActiveFixItem) {
          return `
            <div class="teacher-content-card-head">
              <div>
                <h4>Review Knowledge Packet</h4>
                <p data-review-summary-line>${escapeHtml(reviewSummaryLine)}</p>
              </div>
              <span class="teacher-content-pill review">Focused Fix</span>
            </div>
            ${renderReviewQueueList()}
            ${state.reviewBulkMessage ? `<p class="teacher-content-review-bulk-message" data-review-bulk-message>${escapeHtml(state.reviewBulkMessage)}</p>` : ''}
            ${renderFocusedReviewItemFix(activeFixItem)}
            ${state.errors.length ? renderIssueList('Review Messages', state.errors) : ''}
            ${renderReviewAdvancedDetails(draft)}
          `;
        }
        return `
          <div class="teacher-content-card-head">
            <div>
              <h4>Review Knowledge Packet</h4>
              <p data-review-summary-line>${escapeHtml(reviewSummaryLine)}</p>
            </div>
            <span class="teacher-content-pill review">Queued Draft Items</span>
          </div>
          ${renderReviewQueueList()}
          ${isEditingReviewItem ? '<p class="teacher-content-review-edit-mode-note" data-review-edit-mode-note>Editing one item now. Bulk approval controls are hidden until you close this form.</p>' : ''}
          ${renderReviewNeedsReviewSummary(draft)}
          ${state.reviewBulkMessage ? `<p class="teacher-content-review-bulk-message" data-review-bulk-message>${escapeHtml(state.reviewBulkMessage)}</p>` : ''}
          ${renderReviewTable(filteredItems)}
          ${!isEditingReviewItem && filteredItems.length ? renderReviewActionBar(filteredItems, reviewState) : ''}
          ${!filteredItems.length ? renderReviewEmptyQueueActionBar(draft, summary, totalReviewableCount) : ''}
          ${state.errors.length ? renderIssueList('Review Messages', state.errors) : ''}
          ${renderReviewAdvancedDetails(draft)}
          ${state.selectedReviewEvidenceItem ? renderReviewEvidencePanel(state.selectedReviewEvidenceItem) : ''}
        `;
      }
    
    function renderReviewEmptyQueueActionBar(draft, summary = getReviewProgressSummary(draft), totalReviewableCount = getTotalPrimaryDraftItemCount(draft)) {
        const packId = String(draft?.packId || state.selectedDraftPackId || '').trim();
        const packApproved = isDraftPackApproved(packId);
        const noVisibleRowsMessage = totalReviewableCount > 0 && Number(summary?.pending || 0) === 0
          ? 'No visible draft rows remain in this review queue.'
          : 'No visible draft rows are available for review.';
        if (packApproved) {
          const approvedPack = (Array.isArray(state.approved) ? state.approved : []).find((pack) => String(pack?.packId || '').trim() === packId) || {};
          const packName = approvedPack.title || draft?.title || packId || 'Approved knowledge pack';
          const approvedItemCount = getDraftItemCount(approvedPack || draft || {});
          return `
            <section class="teacher-content-review-action-bar" data-review-empty-approved-state>
              <div>
                <strong>Saved and enabled for student answers.</strong>
                <small>${escapeHtml(packName)}${approvedItemCount ? ` · ${escapeHtml(formatNumber(approvedItemCount))} item${approvedItemCount === 1 ? '' : 's'}` : ''}. ${escapeHtml(noVisibleRowsMessage)}</small>
              </div>
              <div class="teacher-content-review-action-buttons">
                <button type="button" class="small-button" data-review-pack-open-approved data-review-pack-id="${escapeAttr(packId)}">View in Saved Knowledge Packs</button>
                <button type="button" class="small-button secondary-small" data-review-done-view-knowledge-packs>Done</button>
                <button type="button" class="small-button secondary-small" data-review-pack-remove data-review-pack-id="${escapeAttr(packId)}">Remove accepted draft copy</button>
              </div>
            </section>
          `;
        }
        return `
          <section class="teacher-content-review-action-bar" data-review-empty-stale-state>
            <div>
              <strong>No approved pack exists for this draft.</strong>
              <small>${escapeHtml(noVisibleRowsMessage)} Remove this stale draft from the active queue or cancel to leave it untouched.</small>
            </div>
            <div class="teacher-content-review-action-buttons">
              <button type="button" class="small-button secondary-small" data-review-cancel>Cancel</button>
              <button type="button" class="small-button" data-review-pack-cleanup data-review-pack-id="${escapeAttr(packId)}">Remove draft from review queue</button>
            </div>
          </section>
        `;
      }
    
    function renderReviewDoneCard() {
        const draft = state.report?.draftPack || getSelectedDraftSummary();
        const donePackId = draft?.packId || state.selectedDraftPackId || '';
        const donePackName = draft?.title || donePackId || '';
        const packApproved = isDraftPackApproved(donePackId);
        const summary = getReviewProgressSummary(draft);
        const canApproveNow = canCreateApprovedPackFromCurrentReport(summary);
        return `
          <section class="teacher-content-review-done" data-review-done-page>
            <div class="teacher-content-card-head">
              <div>
                <h4>Done</h4>
                <p>${packApproved ? 'Saved and enabled for student answers.' : 'Import review is complete for this draft session.'}</p>
              </div>
              <span class="teacher-content-pill ready">Complete</span>
            </div>
            <p>${packApproved ? 'Approved knowledge pack:' : 'Reviewed draft pack:'} <strong data-review-done-pack-name>${escapeHtml(donePackName || 'Current review draft')}</strong></p>
            <p>${packApproved ? 'It is saved in Saved Knowledge Packs and available to student answers.' : 'This draft is still in review until you approve it.'}</p>
            <div class="teacher-content-done-actions">
              ${!packApproved && canApproveNow ? `<button type="button" class="small-button" data-promote-draft data-review-create-approved-pack ${state.promotionActionLoading ? 'disabled' : ''}>${escapeHtml(state.promotionActionLoading ? 'Approving...' : 'Approve Pack')}</button>` : ''}
              <button type="button" class="small-button secondary-small" data-review-done-view-knowledge-packs>View in Saved Knowledge Packs</button>
            </div>
          </section>
        `;
      }
    
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
    
    function renderBulkReviewSummary() {
        const queuePacks = buildReviewQueuePacks();
        if (queuePacks.length <= 1) return '';
        const currentIndex = Math.max(0, queuePacks.findIndex((pack) => pack.packId === state.selectedDraftPackId));
        const reviewPosition = `${currentIndex + 1} of ${queuePacks.length}`;
        return `
          <section class="teacher-content-review-bulk-summary" data-review-bulk-summary data-review-queue-visible>
            <p data-review-bulk-summary-line>Review queue ${escapeHtml(reviewPosition)}</p>
            <ul class="teacher-content-review-bulk-summary-list" data-review-bulk-summary-list>
              ${queuePacks.map((pack) => `
                <li>
                  <button
                    type="button"
                    class="teacher-content-review-pack-card ${pack.packId === state.selectedDraftPackId ? 'active' : ''}"
                    data-review-pack-select
                    data-review-pack-id="${escapeAttr(pack.packId || '')}"
                    ${pack.packId ? '' : 'disabled'}
                  >
                    <strong>${escapeHtml(pack.title)}</strong>
                    <span>${escapeHtml(pack.statusLabel)}</span>
                    ${pack.itemCountLabel ? `<small>${escapeHtml(pack.itemCountLabel)}</small>` : ''}
                  </button>
                </li>
              `).join('')}
            </ul>
          </section>
        `;
      }
    
    function renderReviewQueueList() {
        const queuePacks = buildReviewQueuePacks();
        if (!queuePacks.length) return '';
        const allAccepted = areAllReviewQueuePacksAccepted(queuePacks);
        const selectedAccepted = isCurrentSelectedDraftAccepted(queuePacks);
        const currentIndex = Math.max(0, queuePacks.findIndex((pack) => pack.packId === state.selectedDraftPackId));
        const queueSummary = queuePacks.length > 1
          ? `Reviewing ${formatNumber(queuePacks.length)} draft packs together • current approval target ${formatNumber(currentIndex + 1)} of ${formatNumber(queuePacks.length)}`
          : `Reviewing ${formatNumber(queuePacks.length)} draft pack`;
        return `
          <section class="teacher-content-review-queue" data-review-queue-visible>
            <p data-review-bulk-summary-line>${escapeHtml(queueSummary)}</p>
            ${allAccepted ? '<p class="teacher-content-review-bulk-message" data-review-all-accepted-message>All selected draft packs have been reviewed.</p>' : ''}
            <ul class="teacher-content-review-queue-list" data-review-bulk-summary-list>
              ${queuePacks.map((pack) => `
                <li>
                  <div class="teacher-content-review-pack-card ${pack.packId === state.selectedDraftPackId ? 'active' : ''}">
                    <button
                      type="button"
                      data-review-pack-select
                      data-review-pack-id="${escapeAttr(pack.packId || '')}"
                      ${pack.packId ? '' : 'disabled'}
                    >
                      <strong>${escapeHtml(pack.title)}</strong>
                      <span>${escapeHtml(pack.statusLabel)}</span>
                      ${pack.itemCountLabel ? `<small>${escapeHtml(pack.itemCountLabel)}</small>` : ''}
                    </button>
                    <div class="teacher-content-review-pack-card-actions">
                      ${pack.hasApproved ? `<button type="button" class="small-button secondary-small" data-review-pack-open-approved data-review-pack-id="${escapeAttr(pack.packId || '')}">Open approved pack</button>` : ''}
                      ${pack.hasApproved && pack.packId ? `<button type="button" class="small-button secondary-small" data-review-pack-remove data-review-pack-id="${escapeAttr(pack.packId || '')}">Remove accepted draft copy from active drafts</button>` : ''}
                    </div>
                  </div>
                </li>
              `).join('')}
            </ul>
            ${selectedAccepted ? `
              <section class="teacher-content-review-action-bar" data-review-accepted-pack-state>
                <div>
                  <strong>Saved and enabled for student answers.</strong>
                  <small>This accepted pack is in Saved Knowledge Packs. Review another draft or clear this accepted draft copy from the queue.</small>
                </div>
                <div class="teacher-content-review-action-buttons">
                  <button type="button" class="small-button" data-review-pack-open-approved data-review-pack-id="${escapeAttr(state.selectedDraftPackId || '')}">View in Saved Knowledge Packs</button>
                  <button type="button" class="small-button secondary-small" data-review-pack-next-pending>Review another draft</button>
                  <button type="button" class="small-button secondary-small" data-review-pack-remove data-review-pack-id="${escapeAttr(state.selectedDraftPackId || '')}">Remove accepted draft copy from active drafts</button>
                </div>
              </section>
            ` : ''}
          </section>
        `;
      }
    
    function buildReviewQueuePacks() {
        const uploadQueue = Array.isArray(state.uploadQueue) ? state.uploadQueue : [];
        const removedPackIds = new Set((Array.isArray(state.reviewQueueRemovedPackIds) ? state.reviewQueueRemovedPackIds : []).map((packId) => String(packId || '').trim()));
        const draftLookup = new Map((Array.isArray(state.drafts) ? state.drafts : []).map((draft) => [String(draft.packId || ''), draft]));
        const approvedLookup = new Map((Array.isArray(state.approved) ? state.approved : []).map((pack) => [String(pack.packId || ''), pack]));
        const queueCards = uploadQueue.map((item) => {
          const status = String(item?.status || 'waiting').toLowerCase();
          const packId = String(item?.packId || '').trim();
          const draft = packId ? draftLookup.get(packId) || null : null;
          const approved = packId ? approvedLookup.get(packId) || null : null;
          const title = String(item?.proposedPackName || draft?.title || approved?.title || item?.fileName || 'Draft pack').trim();
          const summary = summarizeDraftReviewCounts(draft || {});
          const itemCount = getDraftItemCount(draft || approved || {});
          const reviewed = summary.approved + summary.rejected;
          let statusLabel = 'needs review';
          if (approved) statusLabel = 'accepted';
          else if (status === 'failed') statusLabel = 'failed';
          else if (!packId || status === 'waiting' || status === 'extracting' || status === 'processing') statusLabel = 'needs review';
          else if (itemCount === 0) statusLabel = 'empty';
          else if (summary.pending > 0 && reviewed > 0) statusLabel = 'partially reviewed';
          else if (summary.pending === 0 && reviewed > 0) statusLabel = 'reviewed';
          return {
            packId,
            title,
            statusLabel,
            itemCountLabel: `${formatNumber(itemCount)} items`,
            hasApproved: Boolean(approved)
          };
        }).filter((pack) => !removedPackIds.has(pack.packId));
        if (queueCards.length) return queueCards;
        const activeDraftCards = (Array.isArray(state.drafts) ? state.drafts : []).map((draft) => {
          const summary = summarizeDraftReviewCounts(draft || {});
          const itemCount = getDraftItemCount(draft || {});
          const reviewed = summary.approved + summary.rejected;
          const packId = String(draft?.packId || '');
          const approved = packId ? approvedLookup.get(packId) || null : null;
          let statusLabel = 'needs review';
          if (approved) statusLabel = 'accepted';
          else if (itemCount === 0) statusLabel = 'empty';
          else if (summary.pending > 0 && reviewed > 0) statusLabel = 'partially reviewed';
          else if (summary.pending === 0 && reviewed > 0) statusLabel = 'reviewed';
          return {
            packId,
            title: draft?.title || draft?.packId || 'Draft pack',
            statusLabel,
            itemCountLabel: `${formatNumber(itemCount)} items`,
            hasApproved: Boolean(approved)
          };
        }).filter((pack) => !removedPackIds.has(pack.packId));
        if (activeDraftCards.length) return activeDraftCards;
        return (Array.isArray(state.approved) ? state.approved : []).map((pack) => {
          const packId = String(pack?.packId || '');
          const itemCount = getDraftItemCount(pack || {});
          return {
            packId,
            title: pack?.title || packId || 'Approved pack',
            statusLabel: 'accepted',
            itemCountLabel: `${formatNumber(itemCount)} items`,
            hasApproved: true
          };
        }).filter((pack) => pack.packId && !removedPackIds.has(pack.packId));
      }
    
    function isCurrentSelectedDraftAccepted(queuePacks = buildReviewQueuePacks()) {
        return queuePacks.some((pack) => pack.packId === state.selectedDraftPackId && pack.hasApproved === true);
      }
    
    function areAllReviewQueuePacksAccepted(queuePacks = buildReviewQueuePacks()) {
        const withPackIds = queuePacks.filter((pack) => String(pack.packId || '').trim());
        return withPackIds.length > 0 && withPackIds.every((pack) => pack.hasApproved === true);
      }
    
    function summarizeDraftReviewCounts(draft = {}) {
        const counts = draft?.reviewCounts || {};
        return {
          pending: Number(counts.pending || draft?.totalPending || 0),
          approved: Number(counts.approved || 0),
          rejected: Number(counts.rejected || draft?.totalRejected || 0)
        };
      }
    
    function getDraftItemCount(draft = {}) {
        const counts = draft?.itemCounts || {};
        const fromItemCounts = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
        if (fromItemCounts > 0) return fromItemCounts;
        const reviewCounts = draft?.reviewCounts || {};
        const fromReviewCounts = Number(reviewCounts.pending || 0) + Number(reviewCounts.approved || 0) + Number(reviewCounts.rejected || 0);
        if (fromReviewCounts > 0) return fromReviewCounts;
        return Number(draft?.totalPending || 0) + Number(draft?.totalRejected || 0);
      }
    
    function renderReviewFilters() {
        const filters = [
          { id: 'all', label: 'All' },
          { id: 'vocabulary', label: 'Vocabulary' },
          { id: 'concepts', label: 'Concepts' },
          { id: 'referenceFormulas', label: 'Reference Formulas' },
          { id: 'needsReview', label: 'Needs Review' }
        ];
        return `
          <nav class="teacher-content-review-filters" data-review-filter-tabs>
            ${filters.map((filter) => `
              <button
                type="button"
                class="teacher-content-review-filter ${state.reviewListFilter === filter.id ? 'active' : ''}"
                data-review-filter="${escapeAttr(filter.id)}"
              >${escapeHtml(filter.label)}</button>
            `).join('')}
          </nav>
        `;
      }
    
    function renderReviewNeedsReviewSummary(draft = {}) {
        const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
        const failedSections = buildTeacherFriendlyFailedSections(coverage);
        const failedChunks = countFailedAfterRetrySections(coverage);
        if (!failedSections.length && failedChunks === 0) return '';
        const summaryCount = failedSections.length || failedChunks;
        return `
          <section class="teacher-content-review-needs-review" data-review-needs-review-summary>
            <p>${formatNumber(summaryCount)} section${summaryCount === 1 ? '' : 's'} could not be processed. You can still review and accept the items that were created.</p>
            <button type="button" class="small-button secondary-small" data-review-needs-review-toggle>${state.reviewNeedsReviewExpanded ? 'Hide sections needing review' : 'Show sections needing review'}</button>
            ${state.reviewNeedsReviewExpanded ? `
              <ul data-review-needs-review-list>
                ${failedSections.map((section) => `<li>${escapeHtml(section.sourceLocation)}: ${escapeHtml(section.reason)}</li>`).join('')}
              </ul>
            ` : ''}
          </section>
        `;
      }
    
    function renderReviewTable(items) {
        const rows = Array.isArray(items) ? items : [];
        if (!rows.length) {
          if (state.reviewListFilter === 'all' && !hasAnyPrimaryDraftItems()) {
            return '<p class="profile-empty-state" data-review-empty-list>No draft items were created from the current review queue.</p>';
          }
          if (state.reviewListFilter === 'all' && hasAnyPrimaryDraftItems()) {
            return '<p class="profile-empty-state" data-review-empty-list>No visible draft items remain across the current review queue. Deleted rows are excluded from this list.</p>';
          }
          if (state.reviewListFilter !== 'all' && getVisibleReviewItems().length > 0) {
            return '<p class="profile-empty-state" data-review-empty-list>No rows match this filter. Choose All to see every item.</p>';
          }
          return '<p class="profile-empty-state" data-review-empty-list>No review rows match this filter.</p>';
        }
        return `
          <section class="teacher-content-review-table-shell" data-review-combined-table data-review-draft-content-page>
            <div class="teacher-content-review-table-head">
              <span aria-hidden="true"></span>
              ${renderReviewSortControl('source', 'Source')}
              ${renderReviewSortControl('itemType', 'Item Type')}
              ${renderReviewSortControl('title', 'Title')}
              <span>Preview</span>
              ${renderReviewSortControl('status', 'Status / Warning')}
              <span>Actions</span>
            </div>
            <div class="teacher-content-review-table-body">
              ${rows.map((item) => renderReviewTableRow(item)).join('')}
            </div>
          </section>
        `;
      }
    
    function renderReviewTableRow(item) {
        const itemKey = reviewItemKeyForItem(item);
        const selected = state.selectedReviewItemKeys.includes(itemKey);
        const safe = isReviewItemReadyForPack(item);
        const wording = getDraftItemWording(item);
        const realStatus = formatReviewItemStatusLabel(item);
        const blockerSummary = summarizeReviewItemActionNeeded(item);
        const inlineMessage = getReviewInlineMessage(item);
        const actionLabel = 'Edit';
        const isRejected = getItemReviewWorkflowStatus(item) === 'rejected';
        const blockers = getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' });
        const identityAttrs = renderReviewItemIdentityDataAttrs(item);
        const sourceLabel = formatReviewItemSource(item);
        const sourceDetail = item.sourceLocation || item.sourceFile || item.draftPackId || (state.report?.draftPack?.title || state.selectedDraftPackId || '');
        const previewText = shortenReviewPreview(wording);
        const titleText = getReviewItemPrimaryLabel(item);
        return `
          <article class="teacher-content-review-table-row ${selected ? 'selected' : ''} ${safe ? '' : 'unsafe'}" data-review-table-row data-review-item-card data-review-item-key="${escapeAttr(itemKey)}" data-review-item-safe="${safe ? 'true' : 'false'}">
            <label class="teacher-content-review-select-control" data-review-select-control>
              <input
                type="checkbox"
                ${selected ? 'checked' : ''}
                data-review-selection-checkbox
                data-review-selection-item-key="${escapeAttr(itemKey)}"
                data-draft-pack-id="${escapeAttr(item.draftPackId || state.selectedDraftPackId || '')}"
                data-section="${escapeAttr(item.section)}"
                data-index="${escapeAttr(item.index)}"
                aria-label="Select draft item for Accept Selected"
              >
            </label>
            <div class="teacher-content-review-source" data-review-item-source>
              <strong>${escapeHtml(sourceLabel)}</strong>
              <small>${escapeHtml(sourceDetail || 'No source detail')}</small>
            </div>
            <span class="teacher-content-review-chip" data-review-item-category>${escapeHtml(SECTION_LABELS[item.section] || item.section || 'Not set')}</span>
            <strong data-review-item-title>${escapeHtml(titleText)}</strong>
            <div class="teacher-content-review-wording">
              <p data-review-item-wording>${escapeHtml(previewText)}</p>
            </div>
            <div class="teacher-content-review-status" data-review-item-status-warning>
              <small data-review-item-real-status>${escapeHtml(realStatus)}</small>
              ${blockerSummary.message && !safe ? `<small data-review-item-action-needed>${escapeHtml(blockerSummary.message)}</small>` : ''}
              ${blockers.length ? `<small data-review-item-source-issue>${escapeHtml(blockers.join('; '))}</small>` : ''}
              ${inlineMessage ? `<p class="teacher-content-review-inline-message" data-review-item-inline-message>${escapeHtml(inlineMessage)}</p>` : ''}
            </div>
            <div class="teacher-content-review-row-actions">
              <button type="button" class="small-button secondary-small" data-review-edit data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>${escapeHtml(actionLabel)}</button>
              <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs} ${isRejected ? 'disabled' : ''}>Delete</button>
            </div>
          </article>
        `;
      }
    
    function renderReviewAdvancedDetails(draft = {}) {
        const coverage = draft?.metadata?.importCoverage || state.report?.coverageReport || {};
        const sourceManifest = Array.isArray(coverage.sourceManifest) ? coverage.sourceManifest : [];
        const coverageSummary = coverage.coverageSummary || state.report?.coverageReport?.coverageSummary || {};
        const reviewDebugEvents = Array.isArray(state.reviewDebugEvents) ? state.reviewDebugEvents : [];
        const technicalWarnings = [
          ...(Array.isArray(state.report?.warnings) ? state.report.warnings : []),
          ...(Array.isArray(state.report?.technicalErrors) ? state.report.technicalErrors : []),
          ...(Array.isArray(state.report?.errors) ? state.report.errors : [])
        ].filter((warning) => !isPausedStandardsWarning(warning));
        return `
          <details class="teacher-content-review-advanced-details" data-review-advanced-details>
            <summary>Advanced details</summary>
            ${technicalWarnings.length ? renderIssueList('Technical warnings', technicalWarnings) : ''}
            ${renderCoverageReport(state.report?.coverageReport)}
            ${Object.keys(coverageSummary).length ? `<pre data-review-coverage-summary>${escapeHtml(JSON.stringify(coverageSummary, null, 2))}</pre>` : ''}
            ${sourceManifest.length ? `<pre data-review-source-manifest>${escapeHtml(JSON.stringify(sourceManifest, null, 2))}</pre>` : '<p>No source manifest entries.</p>'}
            ${reviewDebugEvents.length ? `<pre data-review-debug-events>${escapeHtml(JSON.stringify(reviewDebugEvents, null, 2))}</pre>` : ''}
          </details>
        `;
      }
    
    function isPausedStandardsWarning(value) {
        const text = String(value || '');
        return PAUSED_STANDARDS_WARNING_PATTERNS.some((pattern) => pattern.test(text));
      }
    
    function getFilteredReviewItems(items) {
        const list = Array.isArray(items) ? items : [];
        return list.filter((item) => isReviewFilterMatch(item, state.reviewListFilter));
      }
    
    function isReviewFilterMatch(item, filterId) {
        if (!filterId || filterId === 'all') return true;
        if (filterId === 'needsReview') {
          return isItemNeedingTeacherReview(item);
        }
        return item.section === filterId;
      }
    
    function setReviewListFilter(filterId) {
        const nextFilter = ['all', 'vocabulary', 'concepts', 'referenceFormulas', 'needsReview'].includes(filterId) ? filterId : 'all';
        state.reviewListFilter = nextFilter;
        state.selectedReviewItemKeys = state.selectedReviewItemKeys.filter((key) => {
          const item = findPendingItemByKey(key);
          return item && isReviewFilterMatch(item, nextFilter);
        });
        render();
      }
    
    function setReviewSort(sortKey) {
        const nextKey = ['source', 'itemType', 'title', 'status'].includes(sortKey) ? sortKey : '';
        if (!nextKey) return;
        if (state.reviewSortKey === nextKey) {
          state.reviewSortDirection = state.reviewSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.reviewSortKey = nextKey;
          state.reviewSortDirection = 'asc';
        }
        render();
      }
    
    function getSortedReviewItems(items) {
        const list = Array.isArray(items) ? [...items] : [];
        const direction = state.reviewSortDirection === 'desc' ? -1 : 1;
        return list.sort((left, right) => {
          const leftValue = getReviewSortValue(left, state.reviewSortKey);
          const rightValue = getReviewSortValue(right, state.reviewSortKey);
          if (leftValue < rightValue) return -1 * direction;
          if (leftValue > rightValue) return 1 * direction;
          return reviewItemKeyForItem(left).localeCompare(reviewItemKeyForItem(right));
        });
      }
    
    function getReviewSortValue(item, sortKey) {
        const key = String(sortKey || 'source');
        if (key === 'itemType') {
          return String(SECTION_LABELS[item?.section] || item?.section || '').toLowerCase();
        }
        if (key === 'title') {
          return String(getReviewItemPrimaryLabel(item) || '').toLowerCase();
        }
        if (key === 'status') {
          return String(formatReviewItemStatusLabel(item) || '').toLowerCase();
        }
        return String(formatReviewItemSource(item) || '').toLowerCase();
      }
    
    function renderReviewSortControl(sortKey, label) {
        const active = state.reviewSortKey === sortKey;
        const arrow = active ? (state.reviewSortDirection === 'asc' ? '↑' : '↓') : '';
        return `
          <button type="button" class="teacher-content-review-sort ${active ? 'active' : ''}" data-review-sort="${escapeAttr(sortKey)}">
            ${escapeHtml(label)}${arrow ? ` ${escapeHtml(arrow)}` : ''}
          </button>
        `;
      }
    
    function formatReviewItemSource(item) {
        const sourcePackName = String(item?.sourcePackName || getDraftTitleForPackId(item?.draftPackId) || '').trim();
        const sourceFile = String(item?.sourceFile || '').trim();
        if (sourcePackName && sourceFile) return `${sourcePackName} · ${sourceFile}`;
        if (sourcePackName) return sourcePackName;
        if (sourceFile) return sourceFile;
        return String(state.report?.draftPack?.title || state.selectedDraftPackId || 'Current draft').trim();
      }
    
    function shortenReviewPreview(value, maxLength = 180) {
        const text = String(value || '').trim().replace(/\s+/g, ' ');
        if (!text) return 'No preview text available.';
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
      }
    
    function renderReviewActionBar(items, reviewState = getReviewStateSnapshot()) {
        if (isCurrentSelectedDraftAccepted()) return '';
        const visible = Array.isArray(items) ? items : [];
        const allRows = Array.isArray(reviewState.reviewableItems) ? reviewState.reviewableItems : getVisibleReviewItems();
        const selectedRows = allRows.filter((item) => state.selectedReviewItemKeys.includes(reviewItemKeyForItem(item)));
        const totalSelected = selectedRows.length;
        const visibleKeys = visible.map((item) => reviewItemKeyForItem(item));
        const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => state.selectedReviewItemKeys.includes(key));
        const selectedReady = selectedRows.filter(isReviewItemSelectableForAcceptSelected).length;
        const selectedNeedsEdit = Math.max(0, selectedRows.length - selectedReady);
        const safeAll = visible.filter(isReviewItemReadyForPack).length;
        const acceptSelectedDisabled = state.reviewActionLoading || state.promotionActionLoading || selectedRows.length === 0 || selectedReady === 0;
        const acceptAllDisabled = state.reviewActionLoading || state.promotionActionLoading;
        const excludeSelectedDisabled = state.reviewActionLoading || state.promotionActionLoading || selectedRows.length === 0;
        const blockingDetails = summarizeAcceptSelectedBlockingDetails(selectedRows.filter((item) => !isReviewItemSelectableForAcceptSelected(item)));
        const acceptSelectedTitle = selectedReady > 0
          ? 'Save checked valid rows into one combined knowledge pack.'
          : selectedReviewItemsHaveBlockers()
            ? `Accept Selected is blocked by: ${blockingDetails || 'selected rows that still need edits or exclusion.'}`
            : 'Check at least one valid row to save into one combined knowledge pack.';
        const acceptAllTitle = 'Publish this draft into one combined knowledge pack (skips rejected and structurally unusable rows).';
        return `
          <section class="teacher-content-review-action-bar" data-review-bottom-action-bar>
            <div>
              <strong data-review-selected-count>${formatNumber(totalSelected)} selected</strong>
              <span data-review-valid-selected-count>${formatNumber(selectedReady)} selected row${selectedReady === 1 ? '' : 's'} ready for Accept Selected</span>
              <span data-review-selected-needs-edit-count>${formatNumber(selectedNeedsEdit)} selected row${selectedNeedsEdit === 1 ? '' : 's'} need edit or exclusion</span>
              <span data-review-valid-all-count>${formatNumber(safeAll)} visible row${safeAll === 1 ? '' : 's'} ready for the pack</span>
              <small data-review-approved-pack-note>Accept creates a saved JSON knowledge pack. It stays disabled for student answers until enabled from Saved Knowledge Packs.</small>
              ${selectedReady === 0 && totalSelected > 0 ? `<small data-review-accept-selected-disabled-reason>${escapeHtml(acceptSelectedTitle)}</small>` : ''}
            </div>
            <div class="teacher-content-review-action-buttons">
              <button type="button" class="small-button secondary-small" data-review-select-all>${allVisibleSelected ? 'Unselect visible' : 'Select all visible'}</button>
              <button type="button" class="small-button secondary-small" data-review-clear-selection ${totalSelected === 0 ? 'disabled' : ''}>Clear selection</button>
              <button type="button" class="small-button secondary-small" data-review-exclude-selected ${excludeSelectedDisabled ? 'disabled' : ''}>Exclude selected</button>
              <button type="button" class="small-button secondary-small" data-review-cancel>Cancel</button>
              <button type="button" class="small-button" data-review-accept-selected ${acceptSelectedDisabled ? 'disabled' : ''} title="${escapeAttr(acceptSelectedTitle)}">Accept Selected</button>
              <button type="button" class="small-button" data-review-accept-all ${acceptAllDisabled ? 'disabled' : ''} title="${escapeAttr(acceptAllTitle)}">Accept All Valid</button>
            </div>
          </section>
        `;
      }

    function summarizeAcceptSelectedBlockingDetails(blockedItems) {
        const list = Array.isArray(blockedItems) ? blockedItems : [];
        if (!list.length) return '';
        const details = list.slice(0, 3).map((item) => {
          const label = getReviewItemPrimaryLabel(item);
          const blockers = getAcceptSelectedBlockersForItem(item);
          const reason = blockers.length
            ? blockers.join('; ')
            : 'needs review before acceptance';
          return `${label}: ${reason}`;
        });
        const extraCount = list.length - details.length;
        if (extraCount > 0) {
          details.push(`${formatNumber(extraCount)} more selected row${extraCount === 1 ? '' : 's'} blocked`);
        }
        return details.join(' | ');
      }
    
    function getDraftItemWording(item) {
        const fields = item?.editableFields && typeof item.editableFields === 'object' ? item.editableFields : {};
        const orderedValues = [
          item?.draftWording,
          item?.studentDefinition,
          item?.studentExplanation,
          item?.expectedAnswer,
          item?.question,
          item?.equation,
          item?.standardId,
          fields.studentDefinition,
          fields.studentExplanation,
          fields.expectedAnswer,
          fields.equation,
          fields.standardId,
          fields.teacherDefinition,
          fields.misconception
        ];
        const value = orderedValues.find((entry) => {
          if (Array.isArray(entry)) return entry.length > 0;
          return String(entry || '').trim();
        });
        if (Array.isArray(value)) return value.join(' ');
        return String(value || 'Draft wording not available in this report item.');
      }
    
    function renderFocusedReviewItemFix(item) {
        if (!item) {
          return `
            <section class="teacher-content-review-focused-fix" data-review-focused-fix data-review-focused-edit-view>
              <div class="teacher-content-review-focused-head">
                <div>
                  <h4>Fix draft item</h4>
                  <p>The selected draft item could not be found after the latest refresh.</p>
                </div>
                <div class="teacher-content-review-detail-actions">
                  <button type="button" class="small-button secondary-small" data-review-fix-back>Back to issues</button>
                  <button type="button" class="small-button secondary-small" data-review-close>Cancel</button>
                </div>
              </div>
              <p class="teacher-content-review-inline-message" data-review-focused-message>Could not find this item. Return to Issues to fix and reopen it from the refreshed list.</p>
            </section>
          `;
        }
    
        const editableFields = EDITABLE_FIELDS[item.section] || [];
        const blockers = getReviewIssueBlockersForItem(item);
        const inlineMessage = getReviewInlineMessage(item);
        const title = getReviewItemPrimaryLabel(item);
        const category = SECTION_LABELS[item.section] || item.section || 'Not set';
        const statusLabel = formatReviewItemStatusLabel(item);
        const identityAttrs = renderReviewItemIdentityDataAttrs(item);
        const blockerList = blockers.length
          ? blockers
          : ['Ready for approved pack'];
        return `
          <section class="teacher-content-review-focused-fix" data-review-focused-fix data-review-focused-edit-view data-review-detail data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>
            <div class="teacher-content-review-focused-head">
              <div>
                <h4 data-review-focused-title>${escapeHtml(title)}</h4>
                  <p>Edit this exact item, then approve it or delete it from the review list.</p>
              </div>
              <div class="teacher-content-review-detail-actions">
                <button type="button" class="small-button secondary-small" data-review-fix-back>Back to issues</button>
                <button type="button" class="small-button secondary-small" data-review-close>Cancel</button>
              </div>
            </div>
            ${inlineMessage ? `<p class="teacher-content-review-inline-message" data-review-focused-message>${escapeHtml(inlineMessage)}</p>` : ''}
            <div class="teacher-content-detail-grid" data-review-focused-summary>
              ${metric('Item title / term', title)}
              ${metric('Category', category)}
              ${metric('Current status', statusLabel)}
              ${metric('Source file', item.sourceFile || 'No source file')}
              ${metric('Source location', item.sourceLocation || 'No source location')}
            </div>
            <section class="teacher-content-issues" data-review-focused-blockers>
              <h5>Blocker reasons</h5>
              <ul>
                ${blockerList.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join('')}
              </ul>
            </section>
            <section class="teacher-content-issues" data-review-focused-source>
              <h5>Source text snippet</h5>
              <p data-review-item-snippet>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
            </section>
            <section class="teacher-content-edit-section" data-review-focused-edit-fields>
              <h5>Editable fields</h5>
              <p>These full-width fields are the values that will be sent with this item approval.</p>
              <div class="teacher-content-edit-fields">
                ${editableFields.map((fieldName) => renderEditableField(fieldName, getReviewEditableFieldValue(item, fieldName))).join('')}
              </div>
            </section>
            <div class="teacher-content-review-detail-actions">
              <button type="button" class="small-button secondary-small" data-review-save-edits data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>Save changes</button>
              <button type="button" class="small-button" data-review-status="approved" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>Approve item</button>
              <button type="button" class="small-button secondary-small" data-review-status="rejected" data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>Delete item</button>
              <button type="button" class="small-button secondary-small" data-review-fix-back>Return to review list</button>
            </div>
          </section>
        `;
      }
    
    function renderReviewIssuesToFix(items) {
        const list = (Array.isArray(items) ? items : []).filter((item) => {
          if (!item) return false;
          if (getItemReviewWorkflowStatus(item) === 'rejected') return false;
          return hasMissingRequiredReviewFields(item) || getReviewItemPromotionBlockers({ ...item, reviewStatus: 'approved' }).length > 0;
        });
        if (!list.length) return '';
        return `
          <section class="teacher-content-review-issues-to-fix" data-review-issues-to-fix>
            <h5>Issues to fix</h5>
            <p data-review-issues-guidance>Fix or reject each issue. Once all remaining items are ready, create the approved pack.</p>
            <ul>
              ${list.map((item) => {
                const blockers = getReviewIssueBlockersForItem(item);
                const reason = blockers.length ? blockers.join('; ') : 'Ready for approved pack';
                const identityAttrs = renderReviewItemIdentityDataAttrs(item);
                return `
                  <li data-review-issue-row>
                    <div>
                      <strong>${escapeHtml(item.label || item.term || item.id || 'Draft item')}</strong>
                      <p>${escapeHtml(SECTION_LABELS[item.section] || item.section || 'Not set')} · Reason: ${escapeHtml(reason)}</p>
                    </div>
                    <button type="button" class="small-button secondary-small" data-review-edit data-review-fix-item data-section="${escapeAttr(item.section)}" data-index="${escapeAttr(item.index)}"${identityAttrs}>Fix this item</button>
                  </li>
                `;
              }).join('')}
            </ul>
          </section>
        `;
      }
    
    function renderReviewEvidencePanel(item) {
        return `
          <section class="teacher-content-review-evidence-card" data-review-evidence-card>
            <div class="teacher-content-card-head">
              <div>
                <h4>Source evidence</h4>
                <p>${escapeHtml(item.label || 'Pending item')} · ${escapeHtml(item.sourceFile || 'No source file')}</p>
              </div>
              <button type="button" class="teacher-content-close" aria-label="Close evidence" data-review-evidence-close>×</button>
            </div>
            <div class="teacher-content-detail-grid">
              ${metric('Section', SECTION_LABELS[item.section] || item.section)}
              ${metric('Index', item.index)}
              ${metric('Source', `${item.sourceFile || 'No source file'} · ${item.sourceLocation || 'No source location'}`)}
              ${metric('Confidence', formatConfidence(item.confidence).label)}
            </div>
            <section class="teacher-content-issues">
              <h5>Evidence snippet</h5>
              <p data-review-item-snippet>${escapeHtml(item.sourceTextSnippet || 'No source snippet available.')}</p>
            </section>
          </section>
        `;
      }
    
    function renderEditableField(fieldName, value) {
        const stringValue = formatEditableFieldValue(value);
        return `
          <label class="teacher-content-edit-field">
            <span>${escapeHtml(titleCase(fieldName))}</span>
            <textarea rows="3" data-review-field="${escapeAttr(fieldName)}">${escapeHtml(stringValue)}</textarea>
          </label>
        `;
      }
    
    function getReviewEditableFieldValue(item, fieldName) {
        if (!item || typeof item !== 'object') return '';
        const fields = item.editableFields && typeof item.editableFields === 'object' && !Array.isArray(item.editableFields)
          ? item.editableFields
          : {};
        if (Object.prototype.hasOwnProperty.call(fields, fieldName)) return fields[fieldName];
        return item[fieldName];
      }
    
    function formatEditableFieldValue(value) {
        if (Array.isArray(value)) return value.join(' | ');
        return String(value ?? '');
      }

    return {
      renderReviewCard,
      renderReviewEmptyQueueActionBar,
      renderReviewDoneCard,
      renderReviewSummaryLine,
      renderBulkReviewSummary,
      renderReviewQueueList,
      buildReviewQueuePacks,
      isCurrentSelectedDraftAccepted,
      areAllReviewQueuePacksAccepted,
      summarizeDraftReviewCounts,
      getDraftItemCount,
      renderReviewFilters,
      renderReviewNeedsReviewSummary,
      renderReviewTable,
      renderReviewTableRow,
      renderReviewAdvancedDetails,
      isPausedStandardsWarning,
      getFilteredReviewItems,
      isReviewFilterMatch,
      setReviewListFilter,
      setReviewSort,
      getSortedReviewItems,
      getReviewSortValue,
      renderReviewSortControl,
      formatReviewItemSource,
      shortenReviewPreview,
      renderReviewActionBar,
      getDraftItemWording,
      renderFocusedReviewItemFix,
      renderReviewIssuesToFix,
      renderReviewEvidencePanel,
      renderEditableField,
      getReviewEditableFieldValue,
      formatEditableFieldValue
    };
  }

  ns.createRenderReviewModule = createRenderReviewModule;
})();
