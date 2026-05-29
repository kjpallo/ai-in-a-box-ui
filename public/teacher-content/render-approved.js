(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createRenderApprovedModule(deps = {}) {
    const {
      state,
      byId,
      escapeHtml,
      escapeAttr,
      formatNumber,
      formatDate,
      render,
      setStatus,
      fetchJson,
      ENDPOINTS,
      unwrap,
      getVisibleDraftPacks,
      openDraftPackForReview,
      openOverlay,
      refreshTeacherContentSummaries,
      collectApiIssues,
      renderChipList,
      countPill,
      window
    } = deps;

    function renderKnowledgeManager() {
      const manager = byId('teacherContentKnowledgeManager');
      if (!manager) return;
      const visiblePacks = getVisibleKnowledgePackRows();
      const hasPacks = visiblePacks.length > 0;
      const selectedCount = state.selectedApprovedPackIds.length;
      const visibleCount = visiblePacks.length;
      manager.innerHTML = `
        <div class="teacher-content-card-head">
          <div>
            <h4>Saved Knowledge Packs</h4>
            <p>Draft packs need review and approval first. Approved packs can be enabled for student answers here.</p>
          </div>
        </div>
        ${hasPacks ? `
          <div class="teacher-content-simple-pack-shell" data-knowledge-pack-shell>
            <div class="teacher-content-simple-pack-list" data-knowledge-pack-list>${renderSimpleKnowledgePackRows()}</div>
            ${renderApprovedBulkActions({ selectedCount, visibleCount })}
          </div>
        ` : `
          <section class="teacher-content-approved-empty" data-no-approved-packs-empty-state data-knowledge-packs-blade>
            <strong>No knowledge packs yet.</strong>
            <p>Use Build Knowledge Pack to upload and review content first.</p>
          </section>
        `}
      `;
    }

    function renderSimpleKnowledgePackRows() {
      const approvedRows = state.approved.map((pack) => renderApprovedPack(pack));
      const hiddenDraftPackIds = buildHiddenDraftPackIdSetForSavedList();
      const draftRows = getVisibleDraftPacks()
        .filter((draft) => !hiddenDraftPackIds.has(String(draft?.packId || '').trim()))
        .map((draft) => renderDraftPack(draft));
      return [...approvedRows, ...draftRows].join('');
    }

    function getVisibleKnowledgePackRows() {
      const visibleRows = [];
      const seenPackIds = new Set();
      const hiddenDraftPackIds = buildHiddenDraftPackIdSetForSavedList();
      state.approved.forEach((pack) => {
        const packId = String(pack?.packId || '').trim();
        if (!packId || seenPackIds.has(packId)) return;
        visibleRows.push({
          kind: 'approved',
          packId,
          title: pack.title || packId
        });
        seenPackIds.add(packId);
      });
      getVisibleDraftPacks().forEach((draft) => {
        const packId = String(draft?.packId || '').trim();
        if (!packId || seenPackIds.has(packId) || hiddenDraftPackIds.has(packId)) return;
        visibleRows.push({
          kind: 'draft',
          packId,
          title: draft.title || packId
        });
        seenPackIds.add(packId);
      });
      return visibleRows;
    }

    function buildHiddenDraftPackIdSetForSavedList() {
      const hidden = new Set();
      const approvedByPackId = new Set();
      const approvedByNormalizedTitle = new Map();
      const approvedSourceMetadata = [];
      state.approved.forEach((approved) => {
        const approvedPackId = String(approved?.packId || '').trim();
        if (approvedPackId) approvedByPackId.add(approvedPackId);
        approvedSourceMetadata.push(collectComparablePackSourceMetadata(approved));
        const approvedTitleKey = normalizeComparableTitle(approved?.title || approvedPackId);
        if (!approvedTitleKey) return;
        if (!approvedByNormalizedTitle.has(approvedTitleKey)) approvedByNormalizedTitle.set(approvedTitleKey, []);
        approvedByNormalizedTitle.get(approvedTitleKey).push(approved);
      });

      getVisibleDraftPacks().forEach((draft) => {
        const draftPackId = String(draft?.packId || '').trim();
        if (!draftPackId) return;
        if (approvedByPackId.has(draftPackId)) {
          hidden.add(draftPackId);
          return;
        }

        const draftSourceMetadata = collectComparablePackSourceMetadata(draft);
        const hasSourceMetadataOverlap = approvedSourceMetadata.some((approvedSourceMetadataRecord) => {
          return matchesByComparableSourceMetadata(draftSourceMetadata, approvedSourceMetadataRecord);
        });
        if (hasSourceMetadataOverlap) {
          hidden.add(draftPackId);
          return;
        }

        const titleKey = normalizeComparableTitle(draft?.title || draftPackId);
        if (!titleKey) return;
        const approvedTitleMatches = approvedByNormalizedTitle.get(titleKey) || [];
        if (!approvedTitleMatches.length) return;

        if (draftSourceMetadata.hasStrongSourceMetadata) return;
        const strongerApprovedSourceMatchExists = approvedTitleMatches.some((approved) => hasStrongSourceMetadata(approved));
        if (!strongerApprovedSourceMatchExists) {
          hidden.add(draftPackId);
        }
      });

      return hidden;
    }

    function hasStrongSourceMetadata(packSummary = {}) {
      if (packSummary?.hasStrongSourceMetadata === true) return true;
      if (Array.isArray(packSummary?.sourceUploadIds) && packSummary.sourceUploadIds.some((value) => String(value || '').trim())) return true;
      if (Array.isArray(packSummary?.sourceFileNames) && packSummary.sourceFileNames.some((value) => String(value || '').trim())) return true;
      return false;
    }

    function collectComparablePackSourceMetadata(packSummary = {}) {
      return {
        packId: normalizeComparableTitle(packSummary?.packId),
        sourceUploadIds: collectComparableSet(packSummary?.sourceUploadIds),
        sourceFileNames: collectComparableSet(packSummary?.sourceFileNames),
        combinedSourceDraftPackIds: collectComparableSet(packSummary?.combinedSourceDraftPackIds),
        hasStrongSourceMetadata: hasStrongSourceMetadata(packSummary)
      };
    }

    function collectComparableSet(values) {
      const set = new Set();
      (Array.isArray(values) ? values : []).forEach((value) => {
        const normalized = normalizeComparableTitle(value);
        if (normalized) set.add(normalized);
      });
      return set;
    }

    function matchesByComparableSourceMetadata(draftMetadata, approvedMetadata) {
      if (!draftMetadata || !approvedMetadata) return false;
      if (draftMetadata.packId && approvedMetadata.combinedSourceDraftPackIds.has(draftMetadata.packId)) return true;
      if (hasComparableSetOverlap(draftMetadata.sourceUploadIds, approvedMetadata.sourceUploadIds)) return true;
      if (canFallbackToFileNameOverlap(draftMetadata.sourceUploadIds, approvedMetadata.sourceUploadIds)) {
        return hasComparableSetOverlap(draftMetadata.sourceFileNames, approvedMetadata.sourceFileNames);
      }
      return false;
    }

    function hasComparableSetOverlap(leftSet, rightSet) {
      if (!(leftSet instanceof Set) || !(rightSet instanceof Set) || !leftSet.size || !rightSet.size) return false;
      for (const value of leftSet) {
        if (rightSet.has(value)) return true;
      }
      return false;
    }

    function canFallbackToFileNameOverlap(leftUploadIds, rightUploadIds) {
      const leftHasUploadIds = leftUploadIds instanceof Set && leftUploadIds.size > 0;
      const rightHasUploadIds = rightUploadIds instanceof Set && rightUploadIds.size > 0;
      return leftHasUploadIds !== rightHasUploadIds;
    }

    function normalizeComparableTitle(value) {
      return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    }

    function renderApprovedPacksCard() {
      const history = renderUploadedSourcesHistory();
      const selectedCount = state.selectedApprovedPackIds.length;
      const approvedCount = state.approved.length;
      if (!state.approved.length) {
        return `
          <section class="teacher-content-approved-empty" data-no-approved-packs-empty-state data-knowledge-packs-blade>
            <strong>No approved knowledge packs yet.</strong>
            <p>Review imported draft content before creating approved packs.</p>
            <button type="button" class="small-button secondary-small" data-approved-empty-tab="review">View Review Draft Content</button>
          </section>
          ${history}
        `;
      }

      return `
        <section class="teacher-content-approved-status" data-approved-pack-status-language>
          <span>Approved</span>
          <span>Use Enable for student answers to control student-answer access.</span>
        </section>
        ${renderApprovedBulkActions({ selectedCount, approvedCount })}
        <div class="teacher-content-approved-list" data-knowledge-packs-blade>
          ${state.approved.map(renderApprovedPack).join('')}
        </div>
        ${renderApprovedSearchableSummary()}
        ${history}
      `;
    }

    function renderApprovedBulkActions({ selectedCount, visibleCount }) {
      const selectedDisabled = !selectedCount || state.approvedBulkDeleteSaving;
      const allSelected = visibleCount > 0 && selectedCount === visibleCount;
      const allDisabled = !visibleCount || state.approvedBulkDeleteSaving;
      return `
        <section class="teacher-content-approved-bulk-actions" data-approved-pack-bulk-delete-panel>
          <div>
            <strong>Selected for deletion: <span data-approved-pack-selected-count>${selectedCount}</span> of ${visibleCount}</strong>
            <p>Delete removes selected visible packs from saved teacher-content locations. Activation checkboxes only control student-answer availability on approved packs.</p>
          </div>
          <div class="teacher-content-approved-bulk-buttons">
            <label class="teacher-content-checkbox-control teacher-content-select-all-control">
              <input
                type="checkbox"
                ${allSelected ? 'checked' : ''}
                ${state.approvedBulkDeleteSaving ? 'disabled' : ''}
                data-approved-pack-select-all-checkbox
              >
              <span>Select all</span>
            </label>
            <button
              type="button"
              class="small-button danger-small"
              ${selectedDisabled ? 'disabled' : ''}
              data-approved-pack-bulk-delete-action
            >
              ${state.approvedBulkDeleteSaving ? 'Deleting...' : 'Delete selected'}
            </button>
            <button
              type="button"
              class="small-button danger-small"
              ${allDisabled ? 'disabled' : ''}
              data-approved-pack-delete-all-action
            >Delete all</button>
          </div>
        </section>
        <p class="teacher-content-approved-delete-message" data-approved-pack-bulk-delete-message>${escapeHtml(state.approvedBulkDeleteMessage)}</p>
      `;
    }

    function renderDraftPacksCard() {
      const visibleDrafts = getVisibleDraftPacks();
      if (!visibleDrafts.length) {
        return `
          <section class="teacher-content-approved-empty" data-no-draft-packs-empty-state>
            <strong>No draft knowledge packs yet.</strong>
            <p>Upload content in Create New Knowledge to generate draft packs for review.</p>
          </section>
        `;
      }

      return `
        <section class="teacher-content-approved-status" data-draft-pack-status-language>
          <span>Draft</span>
          <span>Review / Approve each draft before it can be enabled for student answers.</span>
        </section>
        <div class="teacher-content-approved-list" data-draft-pack-list>
          ${visibleDrafts.map(renderDraftPack).join('')}
        </div>
      `;
    }

    function renderDraftPack(draft) {
      const packId = String(draft?.packId || '');
      const title = draft?.title || packId || 'Draft pack';
      const pending = Number(draft?.totalPending || draft?.reviewCounts?.pending || 0);
      const actionLabel = pending > 0 ? 'Continue Review' : 'Review / Approve';
      const selected = state.selectedApprovedPackIds.includes(packId);
      const deleteSaving = state.approvedDeleteSaving[packId] === true;
      return `
        <section class="teacher-content-simple-pack-row teacher-content-draft-pack" data-draft-pack-card data-knowledge-pack-row>
          <label class="teacher-content-row-select" aria-label="Select ${escapeAttr(title)} for deletion">
            <input
              type="checkbox"
              ${selected ? 'checked' : ''}
              ${state.approvedBulkDeleteSaving || !packId ? 'disabled' : ''}
              data-approved-pack-select-checkbox
              data-approved-pack-id="${escapeAttr(packId)}"
            >
          </label>
          <div class="teacher-content-simple-pack-title">
            <strong data-draft-pack-title>${escapeHtml(title)}</strong>
            <span class="teacher-content-pill muted" data-draft-pack-badge>Draft</span>
          </div>
          <div class="teacher-content-simple-pack-toggle">
            <span>Disabled</span>
            <small>Enable for student answers appears after approval.</small>
          </div>
          <div class="teacher-content-simple-pack-actions">
            <button type="button" class="small-button secondary-small" data-draft-pack-view-edit-action data-draft-pack-id="${escapeAttr(packId)}">${escapeHtml(actionLabel)}</button>
            <button type="button" class="small-button danger-small" ${deleteSaving || !packId ? 'disabled' : ''} data-approved-pack-delete-action data-approved-pack-id="${escapeAttr(packId)}" data-approved-pack-title-confirm="${escapeAttr(title)}">
              ${deleteSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </section>
      `;
    }

    function renderApprovedPack(pack) {
      const packId = pack.packId || '';
      const activationEnabled = pack.activationEnabled === true;
      const activationSaving = state.approvedActivationSaving[packId] === true;
      const deleteSaving = state.approvedDeleteSaving[packId] === true;
      const selected = state.selectedApprovedPackIds.includes(packId);
      const activationLabel = activationSaving
        ? 'Saving...'
        : (activationEnabled ? 'Enabled for student answers' : 'Disabled for student answers');
      return `
        <section class="teacher-content-simple-pack-row" data-approved-pack-card data-knowledge-pack-row>
          <label class="teacher-content-row-select" aria-label="Select ${escapeAttr(pack.title || pack.packId || 'approved pack')} for deletion">
            <input
              type="checkbox"
              ${selected ? 'checked' : ''}
              ${state.approvedBulkDeleteSaving || !packId ? 'disabled' : ''}
              data-approved-pack-select-checkbox
              data-approved-pack-id="${escapeAttr(packId)}"
            >
          </label>
          <div class="teacher-content-simple-pack-title">
            <strong data-approved-pack-title>${escapeHtml(pack.title || pack.packId || 'Approved pack')}</strong>
            <span class="teacher-content-pill ready">Approved</span>
          </div>
          <div class="teacher-content-simple-pack-toggle">
            <label class="teacher-content-checkbox-control">
              <input
                type="checkbox"
                ${activationEnabled ? 'checked' : ''}
                ${activationSaving || !packId ? 'disabled' : ''}
                data-approved-pack-toggle-action
                data-approved-pack-id="${escapeAttr(packId)}"
                data-approved-pack-activation-checkbox
              >
              <span>Enable for student answers</span>
            </label>
            <small data-approved-pack-activation-status>${escapeHtml(activationEnabled ? 'Enabled' : 'Disabled')} · ${escapeHtml(activationLabel)}</small>
          </div>
          <div class="teacher-content-simple-pack-actions">
            <button type="button" class="small-button secondary-small" data-approved-pack-view-edit-action data-approved-pack-id="${escapeAttr(packId)}">Edit</button>
            <button type="button" class="small-button danger-small" ${deleteSaving || !packId ? 'disabled' : ''} data-approved-pack-delete-action data-approved-pack-id="${escapeAttr(packId)}" data-approved-pack-title-confirm="${escapeAttr(pack.title || pack.packId || '')}">
              ${deleteSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </section>
      `;
    }

    function renderUploadedSourcesHistory() {
      const sources = Array.isArray(state.uploadedSources) ? state.uploadedSources : [];
      return `
        <section class="teacher-content-uploaded-sources" data-uploaded-sources-history data-upload-history-blade>
          <div class="teacher-content-card-head">
            <div>
              <h5>Uploaded Sources</h5>
              <p>Upload History for extracted source files. Source files, draft packs, and approved packs are preserved.</p>
            </div>
            <span class="teacher-content-pill ${sources.length ? 'ready' : 'muted'}">${sources.length ? 'Available' : 'Empty'}</span>
          </div>
          ${sources.length ? `
            <div class="teacher-content-approved-list">
              ${sources.map(renderUploadedSourceHistoryItem).join('')}
            </div>
          ` : '<p class="profile-empty-state" data-no-uploaded-sources-empty-state>No uploaded source history yet. Extraction records will appear here after files are uploaded.</p>'}
        </section>
      `;
    }

    function renderUploadedSourceHistoryItem(source) {
      const warnings = Array.isArray(source.warnings) ? source.warnings : [];
      const draftPacks = Array.isArray(source.draftPacks) ? source.draftPacks : [];
      const approvedPacks = Array.isArray(source.approvedPacks) ? source.approvedPacks : [];
      return `
        <section class="teacher-content-approved-pack" data-uploaded-source-card>
          <div class="teacher-content-approved-head">
            <div>
              <strong data-uploaded-source-original-filename>${escapeHtml(source.originalFileName || source.storedFileName || 'Uploaded source')}</strong>
              <span data-uploaded-source-upload-id>${escapeHtml(source.uploadId || 'No upload ID')}</span>
            </div>
            <div class="teacher-content-approved-badges">
              <span data-uploaded-source-draft-exists>${source.draftPackExists ? 'Draft pack exists' : 'No draft pack'}</span>
              <span data-uploaded-source-approved-exists>${source.approvedPackExists ? 'Approved pack exists' : 'No approved pack'}</span>
            </div>
          </div>
          <div class="teacher-content-approved-meta">
            ${metadataPill('File type', source.fileType || 'Unknown', 'data-uploaded-source-file-type')}
            ${metadataPill('Extracted pages/slides/sheets', formatNumber(source.extractedUnitCount), 'data-uploaded-source-extracted-count')}
            ${metadataPill('Text-bearing pages/slides', formatNumber(source.textBearingUnitCount), 'data-uploaded-source-text-bearing-count')}
            ${metadataPill('First text-bearing page/slide', source.firstTextBearingUnit ? formatNumber(source.firstTextBearingUnit) : 'None found', 'data-uploaded-source-first-text-bearing')}
            ${metadataPill('Updated', formatDate(source.updatedAt) || 'Not available', 'data-uploaded-source-updated-date')}
          </div>
          ${renderChipList('Draft pack from upload', draftPacks.map(formatPackMatch), 'data-uploaded-source-draft-packs')}
          ${renderChipList('Approved pack from upload', approvedPacks.map(formatPackMatch), 'data-uploaded-source-approved-packs')}
          ${renderChipList('Warnings', warnings, 'data-uploaded-source-warnings')}
        </section>
      `;
    }

    function formatPackMatch(pack) {
      if (!pack) return '';
      return pack.title && pack.packId ? `${pack.title} (${pack.packId})` : pack.packId || pack.title || '';
    }

    function renderApprovedSearchableSummary() {
      const searchable = state.approvedSearchableCounts || state.approvedIndexedCounts || {};
      return `
        <section class="teacher-content-counts" data-approved-searchable-summary>
          <h5>Indexed / Searchable Counts</h5>
          <div class="teacher-content-count-strip">
            ${countPill('Searchable vocabulary terms', searchable.vocabularyTerms, 'data-approved-searchable-vocabulary-terms')}
            ${countPill('Searchable concepts', searchable.concepts, 'data-approved-searchable-concepts')}
            ${countPill('Searchable problem questions', searchable.problemQuestions, 'data-approved-searchable-problem-questions')}
            ${countPill('Searchable standards', searchable.standards, 'data-approved-searchable-standards')}
          </div>
        </section>
      `;
    }

    function metadataPill(label, value, dataAttr = '') {
      return `
        <span class="teacher-content-meta-pill" ${dataAttr}>
          <small>${escapeHtml(label)}</small>
          <strong>${escapeHtml(value)}</strong>
        </span>
      `;
    }

    async function toggleApprovedPackActivation(button) {
      const packId = button.getAttribute('data-approved-pack-id') || '';
      if (!packId || state.approvedActivationSaving[packId]) return;

      const pack = state.approved.find((item) => item.packId === packId);
      const enabled = button.matches?.('input[type="checkbox"]') ? button.checked === true : !(pack && pack.activationEnabled === true);
      state.approvedActivationSaving = { ...state.approvedActivationSaving, [packId]: true };
      state.approvedActivationMessages = { ...state.approvedActivationMessages, [packId]: 'Saving activation setting...' };
      setStatus('Saving activation setting...');
      render();

      try {
        const payload = await fetchJson(ENDPOINTS.approvedActivation(packId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled })
        });
        const data = unwrap(payload);
        state.approvedActivationMessages = {
          ...state.approvedActivationMessages,
          [packId]: data?.message || 'Activation setting saved. This does not change student answers yet.'
        };
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        await refreshTeacherContentSummaries();
        setStatus('Activation setting saved. This does not change student answers yet.');
      } catch (error) {
        state.approvedActivationMessages = {
          ...state.approvedActivationMessages,
          [packId]: `Activation setting failed: ${error.message || 'Route error'}`
        };
        setStatus('Activation setting failed.');
      } finally {
        state.approvedActivationSaving = { ...state.approvedActivationSaving, [packId]: false };
        render();
      }
    }

    async function deleteApprovedPack(button) {
      const packId = button.getAttribute('data-approved-pack-id') || '';
      if (!packId || state.approvedDeleteSaving[packId]) return;

      const confirmed = window.confirm('Are you sure you want to delete this knowledge pack?');
      if (!confirmed) return;

      state.approvedDeleteSaving = { ...state.approvedDeleteSaving, [packId]: true };
      state.approvedDeleteMessages = { ...state.approvedDeleteMessages, [packId]: 'Deleting knowledge pack...' };
      setStatus('Deleting knowledge pack...');
      render();

      try {
        console.log('[knowledge-delete] request', { packId, confirmed });
        const payload = await fetchJson(ENDPOINTS.approvedDelete(packId), {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed })
        });
        console.log('[knowledge-delete] response', payload);
        const data = unwrap(payload);
        state.approvedDeleteMessages = {};
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        await refreshTeacherContentSummaries();
        setStatus('Deleted pack from saved knowledge.');
      } catch (error) {
        console.log('[knowledge-delete] error', { packId, error });
        state.approvedDeleteMessages = {
          ...state.approvedDeleteMessages,
          [packId]: 'Delete failed. Check console/server logs.'
        };
        setStatus('Delete failed. Check console/server logs.');
      } finally {
        state.approvedDeleteSaving = { ...state.approvedDeleteSaving, [packId]: false };
        render();
      }
    }

    function toggleApprovedPackSelection(checkbox) {
      const packId = checkbox.getAttribute('data-approved-pack-id') || '';
      if (!packId) return;

      const selected = new Set(state.selectedApprovedPackIds);
      if (checkbox.checked) {
        selected.add(packId);
      } else {
        selected.delete(packId);
      }
      state.selectedApprovedPackIds = Array.from(selected).filter((selectedPackId) => {
        return getVisibleKnowledgePackRows().some((pack) => pack.packId === selectedPackId);
      });
      state.approvedBulkDeleteMessage = '';
      render();
    }

    function toggleApprovedPackSelectAll(checkbox) {
      const visiblePackIds = getVisibleKnowledgePackRows().map((pack) => pack.packId).filter(Boolean);
      state.selectedApprovedPackIds = checkbox.checked ? visiblePackIds : [];
      state.approvedBulkDeleteMessage = '';
      render();
    }

    async function deleteApprovedPacksById(packIds, options = {}) {
      const visibleByPackId = new Map(getVisibleKnowledgePackRows().map((pack) => [pack.packId, pack]));
      const selectedPacks = packIds
        .map((packId) => visibleByPackId.get(packId))
        .filter(Boolean);
      const count = selectedPacks.length;
      if (!selectedPacks.length || state.approvedBulkDeleteSaving) return;

      const confirmed = window.confirm(
        options.all
          ? 'Are you sure you want to delete all saved knowledge packs?'
          : 'Are you sure you want to delete these selected knowledge packs?'
      );
      if (!confirmed) return;

      state.approvedBulkDeleteSaving = true;
      state.approvedBulkDeleteMessage = `Deleting ${count} knowledge pack${count === 1 ? '' : 's'}...`;
      setStatus(state.approvedBulkDeleteMessage);
      render();

      try {
        const requestPayload = {
          packIds: selectedPacks.map((pack) => pack.packId),
          confirmed: true
        };
        console.log('[knowledge-delete] request', requestPayload);
        const payload = await fetchJson(ENDPOINTS.approvedBulkDelete, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload)
        });
        console.log('[knowledge-delete] response', payload);
        const data = unwrap(payload);
        state.selectedApprovedPackIds = [];
        state.approvedDeleteMessages = {};
        state.approvedBulkDeleteMessage = 'Deleted pack from saved knowledge.';
        if (data?.approvedSummary) applyApprovedSummary(data.approvedSummary);
        await refreshTeacherContentSummaries();
        setStatus(state.approvedBulkDeleteMessage);
      } catch (error) {
        console.log('[knowledge-delete] error', { packIds: selectedPacks.map((pack) => pack.packId), error });
        state.approvedBulkDeleteMessage = `Delete selected failed: ${error.message || 'Route error'}`;
        setStatus('Delete selected knowledge packs failed.');
      } finally {
        state.approvedBulkDeleteSaving = false;
        render();
      }
    }

    async function deleteSelectedApprovedPacks() {
      await deleteApprovedPacksById(state.selectedApprovedPackIds);
    }

    async function deleteAllApprovedPacks() {
      await deleteApprovedPacksById(getVisibleKnowledgePackRows().map((pack) => pack.packId).filter(Boolean), { all: true });
    }

    function toggleApprovedPackDetails(button) {
      const packId = button.getAttribute('data-approved-pack-id') || '';
      if (!packId) return;
      const matchingDraft = state.drafts.find((draft) => String(draft?.packId || '') === packId);
      if (matchingDraft) {
        openDraftPackForReview(packId);
        return;
      }
      openOverlay().then(() => {
        setStatus('This approved pack is view-only here. Edit draft content before approval.');
        render();
      });
    }

    function applyApprovedSummary(data) {
      state.approved = Array.isArray(data?.approvedPacks) ? data.approvedPacks : [];
      pruneSelectedApprovedPackIds();
      state.approvedIndexedCounts = data?.indexedCounts || null;
      state.approvedSearchableCounts = data?.searchableCounts || null;
      collectApiIssues(data);
    }

    function pruneSelectedApprovedPackIds() {
      state.selectedApprovedPackIds = state.selectedApprovedPackIds.filter((packId) => {
        return getVisibleKnowledgePackRows().some((pack) => pack.packId === packId);
      });
    }

    return {
      renderKnowledgeManager,
      renderSimpleKnowledgePackRows,
      getVisibleKnowledgePackRows,
      renderApprovedPacksCard,
      renderApprovedBulkActions,
      renderDraftPacksCard,
      renderDraftPack,
      renderApprovedPack,
      renderUploadedSourcesHistory,
      renderUploadedSourceHistoryItem,
      renderApprovedSearchableSummary,
      toggleApprovedPackActivation,
      deleteApprovedPack,
      toggleApprovedPackSelection,
      toggleApprovedPackSelectAll,
      deleteApprovedPacksById,
      deleteSelectedApprovedPacks,
      deleteAllApprovedPacks,
      toggleApprovedPackDetails,
      applyApprovedSummary,
      pruneSelectedApprovedPackIds
    };
  }

  ns.createRenderApprovedModule = createRenderApprovedModule;
})();
