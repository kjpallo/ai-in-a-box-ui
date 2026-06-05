(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createStandardsPanelModule(deps = {}) {
    const {
      state,
      escapeHtml,
      escapeAttr,
      fetchJson,
      ENDPOINTS,
      unwrap,
      render,
      loadSelectedDraftReport,
      metric,
      formatNumber,
      renderChipList,
      renderInlineChipList,
      formatConfidence
    } = deps;

    async function selectStandardsBank(standardsBankId) {
      state.selectedStandardsBankId = standardsBankId;
      state.selectedStandardsBank = null;
      state.standardsSearch = '';
      state.standardsStrandFilter = '';
      state.standardsTopicFilter = '';
      state.standardsMatchFilter = 'used';
      state.selectedStandardId = '';
      state.standardsBankError = '';
      state.standardsBankLoading = Boolean(standardsBankId);
      render();

      if (standardsBankId) {
        try {
          state.selectedStandardsBank = unwrap(await fetchJson(ENDPOINTS.standardsBank(standardsBankId)));
        } catch (error) {
          state.standardsBankError = `Selected standards set failed to load: ${error.message || 'Route error'}`;
        }
      }

      state.standardsBankLoading = false;
      await loadSelectedDraftReport();
      render();
    }

    function renderStandardsCard() {
      const summary = state.report?.standardsSummary || null;
      const standardIds = Array.isArray(summary?.standardIds) ? summary.standardIds : [];
      const standards = buildStandardsPreviewItems(summary);
      const visibleStandards = filterStandardsPreviewItems(standards);
      const unknown = Array.isArray(summary?.unknown) ? summary.unknown : [];
      const missing = Array.isArray(summary?.missing) ? summary.missing : [];
      const selectedStandard = selectVisibleStandard(visibleStandards);
      if (!state.selectedDraftPackId) {
        return `
          <div class="teacher-content-card-head">
            <div>
              <h4>Standards</h4>
              <p>Connect this knowledge pack to the standards students are expected to learn.</p>
            </div>
            <span class="teacher-content-pill muted">Coming Soon</span>
          </div>
          <p class="profile-empty-state">No draft selected. Create Review Draft from an upload or choose a draft pack to see its standards alignment.</p>
          ${renderStandardsPlaceholders()}
        `;
      }

      return `
        <div class="teacher-content-card-head">
          <div>
            <h4>Standards</h4>
            <p>Connect this knowledge pack to the standards students are expected to learn.</p>
          </div>
          <span class="teacher-content-pill muted">Read Only</span>
        </div>
        ${renderStandardsTools()}
        ${renderSelectedStandardsBankSummary()}
        ${summary?.standardsBankLoaded === false ? '<p class="profile-empty-state" data-standards-bank-empty>Standards bank not loaded. Existing draft IDs are shown without bank details.</p>' : ''}
        <div class="teacher-content-metric-grid">
          ${metric('Standards Map Count', formatNumber(summary?.standardsMapCount), 'data-standards-map-count')}
          ${metric('Standard IDs Used', formatNumber(standardIds.length), 'data-standards-id-count')}
          ${metric('Unknown Standards', formatNumber(unknown.length), 'data-standards-unknown-count')}
          ${metric('Missing Standards', formatNumber(missing.length), 'data-standards-missing-count')}
        </div>
        ${standardIds.length ? renderChipList('Standard IDs', standardIds, 'data-standard-id-list') : '<p class="profile-empty-state" data-standards-empty>No standardsMap entries or standard IDs were found for this draft.</p>'}
        ${unknown.length ? renderChipList('Unknown standards found', unknown, 'data-standards-unknown-list') : ''}
        ${unknown.length ? '<p class="profile-empty-state" data-standards-unknown-bank-copy>Selected draft standard IDs are unknown in this bank.</p>' : ''}
        ${missing.length ? renderChipList('Standards used without standardsMap entries', missing, 'data-standards-missing-list') : ''}
        ${renderStandardsFilters(standards)}
        <p class="teacher-content-upload-note" data-standards-default-used>Default view: Used in this draft. Choose All standards to browse the full selected set.</p>
        ${state.selectedStandardsBankId && !standards.length ? '<p class="profile-empty-state" data-standards-bank-no-standards>Selected standards set has no standards to preview.</p>' : ''}
        ${standards.length && !visibleStandards.length ? '<p class="profile-empty-state" data-standards-filter-empty>No standards match search/filter.</p>' : ''}
        ${visibleStandards.length ? `<div class="teacher-content-standards-layout"><div class="teacher-content-standards-list">${visibleStandards.map(renderStandardCard).join('')}</div></div>${state.selectedStandardId ? renderStandardDetailPanel(selectedStandard) : ''}` : renderStandardDetailPanel(null)}
      `;
    }

    function renderStandardsTools() {
      return `
        <section class="teacher-content-standards-tools" data-standards-placeholder-controls>
          <label class="teacher-content-standards-select">
            <span>Select Saved Standards Set</span>
            <select
              id="teacherContentStandardsBankSelect"
              data-standards-bank-select
              aria-label="Select Saved Standards Set"
              ${state.standardsBankLoading ? 'disabled' : ''}
            >
              ${renderStandardsBankOptions()}
            </select>
          </label>
          <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-upload">Upload standards file</button>
          <label class="teacher-content-standards-select">
            <span>Replace standard</span>
            <select disabled data-coming-soon="standards-replace" aria-label="Replace standard placeholder">
              <option>Replace standard - coming soon</option>
            </select>
          </label>
          <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-edit">Edit standard</button>
          <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-vocab">Vocab</button>
          <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-content-concept">Content/Concept</button>
          <button type="button" class="small-button secondary-small" disabled data-coming-soon="standards-source">Source</button>
        </section>
      `;
    }

    function renderStandardsFilters(standards) {
      const strands = uniqueStandardValues(standards, 'strand');
      const topics = uniqueStandardValues(standards, 'topic');
      const hasBank = Boolean(state.selectedStandardsBankId);
      return `
        <section class="teacher-content-standards-filters" data-standards-filter-controls>
          <label class="teacher-content-standards-field" for="teacherContentStandardsSearch">
            <span>Search standards in this set</span>
            <input
              id="teacherContentStandardsSearch"
              type="search"
              value="${escapeAttr(state.standardsSearch)}"
              placeholder="${hasBank ? 'Search ID, code, title, text, strand, topic, keywords' : 'Select a saved standards set to search bank standards'}"
              data-standards-search
              ${hasBank ? '' : 'disabled'}
            >
          </label>
          <label class="teacher-content-standards-select" for="teacherContentStandardsStrandFilter">
            <span>Strand</span>
            <select id="teacherContentStandardsStrandFilter" data-standards-strand-filter ${strands.length ? '' : 'disabled'}>
              <option value="">${strands.length ? 'All strands' : 'No strand values available'}</option>
              ${strands.map((strand) => `<option value="${escapeAttr(strand)}" ${state.standardsStrandFilter === strand ? 'selected' : ''}>${escapeHtml(strand)}</option>`).join('')}
            </select>
          </label>
          <label class="teacher-content-standards-select" for="teacherContentStandardsTopicFilter">
            <span>Topic</span>
            <select id="teacherContentStandardsTopicFilter" data-standards-topic-filter ${topics.length ? '' : 'disabled'}>
              <option value="">${topics.length ? 'All topics' : 'No topic values available'}</option>
              ${topics.map((topic) => `<option value="${escapeAttr(topic)}" ${state.standardsTopicFilter === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}
            </select>
          </label>
          <label class="teacher-content-standards-select" for="teacherContentStandardsMatchFilter">
            <span>Draft match status</span>
            <select id="teacherContentStandardsMatchFilter" data-standards-match-filter>
              <option value="used" ${state.standardsMatchFilter === 'used' ? 'selected' : ''}>Used in this draft</option>
              <option value="all" ${state.standardsMatchFilter === 'all' ? 'selected' : ''}>All standards</option>
              <option value="unknown" ${state.standardsMatchFilter === 'unknown' ? 'selected' : ''}>Unknown in selected bank / unmatched</option>
            </select>
          </label>
        </section>
      `;
    }

    function renderStandardsPlaceholders() {
      return renderStandardsTools();
    }

    function renderStandardsBankOptions() {
      if (!state.standardsBanks.length) {
        return '<option value="">No saved standards sets found. Standards upload will be added later.</option>';
      }

      return [
        '<option value="">Choose a saved standards set</option>',
        ...state.standardsBanks.map((bank) => `
          <option value="${escapeAttr(bank.standardsBankId)}" ${bank.standardsBankId === state.selectedStandardsBankId ? 'selected' : ''}>
            ${escapeHtml(formatStandardsBankOptionLabel(bank))}
          </option>
        `)
      ].join('');
    }

    function renderSelectedStandardsBankSummary() {
      if (state.standardsBankLoading) {
        return '<p class="profile-empty-state" data-standards-bank-loading>Loading selected standards set...</p>';
      }

      if (state.standardsBankError) {
        return `<p class="profile-empty-state" data-standards-bank-error>${escapeHtml(state.standardsBankError)}</p>`;
      }

      if (!state.selectedStandardsBankId) {
        return '<p class="profile-empty-state" data-standards-bank-unselected>No saved standards set selected. Draft standard IDs are shown without saved-bank enrichment.</p>';
      }

      const selected = state.selectedStandardsBank || state.report?.selectedStandardsBank || state.standardsBanks.find((bank) => bank.standardsBankId === state.selectedStandardsBankId) || {};
      return `
        <section class="teacher-content-selected-bank" data-selected-standards-bank-summary>
          <div>
            <span>Selected Standards Set</span>
            <strong data-selected-standards-bank-title>${escapeHtml(selected.title || state.selectedStandardsBankId)}</strong>
            <small data-selected-standards-bank-id>${escapeHtml(selected.standardsBankId || state.selectedStandardsBankId)}</small>
          </div>
          <div class="teacher-content-selected-bank-meta">
            <span data-selected-standards-bank-subject>${escapeHtml(selected.subject || 'Subject not set')}</span>
            <span data-selected-standards-bank-grade>${escapeHtml(selected.gradeLevel ? `Grade ${selected.gradeLevel}` : 'Grade not set')}</span>
            <span data-selected-standards-bank-jurisdiction>${escapeHtml(selected.jurisdiction || 'Jurisdiction not set')}</span>
            <span data-selected-standards-bank-count>${formatNumber(selected.standardsCount)} standards</span>
            <span data-selected-standards-bank-validation>${selected.validationPassed === false ? 'Validation failed' : 'Validation passed'}</span>
          </div>
        </section>
      `;
    }

    function renderStandardCard(standard) {
      const vocabulary = Array.isArray(standard.relatedVocabulary) ? standard.relatedVocabulary : [];
      const concepts = Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
      const keywords = Array.isArray(standard.keywords) ? standard.keywords : [];
      const confidence = standard.confidence ? formatConfidence(standard.confidence) : null;
      const match = getStandardMatchStatus(standard);
      return `
        <section class="teacher-content-standard-card ${standard.standardId === state.selectedStandardId ? 'selected' : ''}" data-standard-card data-standard-card-id="${escapeAttr(standard.standardId || '')}" tabindex="0">
          <div class="teacher-content-standard-head">
            <div>
              <strong data-standard-id>${escapeHtml(standard.standardId || 'Standard ID not set')}</strong>
              ${standard.code ? `<span data-standard-code>${escapeHtml(standard.code)}</span>` : ''}
              ${standard.title ? `<span data-standard-title>${escapeHtml(standard.title)}</span>` : '<span data-standard-title>No title loaded for this standard.</span>'}
            </div>
            <span class="teacher-content-standard-status ${escapeAttr(match.className)}" data-standard-match-status>${escapeHtml(match.label)}</span>
            ${confidence ? `<span class="teacher-content-confidence ${escapeAttr(confidence.className)}" data-standard-confidence>${escapeHtml(confidence.label)}</span>` : ''}
          </div>
          ${standard.officialText ? `<p data-standard-official-text>${escapeHtml(standard.officialText)}</p>` : ''}
          ${standard.studentFriendlyText ? `<p data-standard-student-friendly-text>${escapeHtml(standard.studentFriendlyText)}</p>` : ''}
          ${!standard.officialText && !standard.studentFriendlyText && standard.description ? `<p data-standard-description>${escapeHtml(standard.description)}</p>` : ''}
          ${!standard.officialText && !standard.studentFriendlyText && !standard.description ? '<p data-standard-description>Only the standard ID is available for this draft.</p>' : ''}
          <div class="teacher-content-standard-meta">
            <span data-standard-bank-match>${escapeHtml(match.label)}</span>
            <span data-standard-strand>Strand: ${escapeHtml(standard.strand || 'Not loaded')}</span>
            <span data-standard-topic>Topic: ${escapeHtml(standard.topic || 'Not loaded')}</span>
            <span data-standard-review-status>Review status: ${escapeHtml(standard.reviewStatus || 'Not set')}</span>
            <span data-standard-source>Source: ${escapeHtml([standard.sourceFile, standard.sourceLocation].filter(Boolean).join(' · ') || 'Not loaded')}</span>
          </div>
          ${renderInlineChipList('Keywords', keywords, 'data-standard-keywords')}
          ${renderInlineChipList('Related vocabulary', vocabulary, 'data-standard-vocabulary')}
          ${renderInlineChipList('Related concepts', concepts, 'data-standard-concepts')}
        </section>
      `;
    }

    function renderStandardDetailPanel(standard) {
      if (!standard) {
        return '<aside class="teacher-content-standard-detail" data-standard-detail-panel><p class="profile-empty-state">Select a standard card to preview full read-only details.</p></aside>';
      }
      const keywords = Array.isArray(standard.keywords) ? standard.keywords : [];
      const vocabulary = Array.isArray(standard.relatedVocabulary) ? standard.relatedVocabulary : [];
      const concepts = Array.isArray(standard.relatedConcepts) ? standard.relatedConcepts : [];
      const confidence = standard.confidence ? formatConfidence(standard.confidence).label : 'Not set';
      return `
        <aside class="teacher-content-standard-detail" data-standard-detail-panel>
          <span class="teacher-content-pill muted">Read Only Detail</span>
          <h5 data-standard-detail-title>${escapeHtml(standard.title || standard.standardId || 'Untitled standard')}</h5>
          <div class="teacher-content-standard-meta">
            <span data-standard-detail-id>Standard ID: ${escapeHtml(standard.standardId || 'Not set')}</span>
            <span data-standard-detail-code>Code: ${escapeHtml(standard.code || 'Not set')}</span>
            <span data-standard-detail-strand>Strand: ${escapeHtml(standard.strand || 'Not loaded')}</span>
            <span data-standard-detail-topic>Topic: ${escapeHtml(standard.topic || 'Not loaded')}</span>
            <span data-standard-detail-confidence>Confidence: ${escapeHtml(confidence)}</span>
            <span data-standard-detail-review-status>Review status: ${escapeHtml(standard.reviewStatus || 'Not set')}</span>
          </div>
          <p data-standard-detail-official-text><strong>Official text:</strong> ${escapeHtml(standard.officialText || 'Not loaded')}</p>
          <p data-standard-detail-student-friendly-text><strong>Student-friendly text:</strong> ${escapeHtml(standard.studentFriendlyText || 'Not loaded')}</p>
          ${renderInlineChipList('Keywords', keywords, 'data-standard-detail-keywords')}
          ${renderInlineChipList('Related vocabulary', vocabulary, 'data-standard-detail-vocabulary')}
          ${renderInlineChipList('Related concepts', concepts, 'data-standard-detail-concepts')}
        </aside>
      `;
    }

    function buildStandardsPreviewItems(summary) {
      const draftStandards = Array.isArray(summary?.standards) ? summary.standards : [];
      const draftById = new Map(draftStandards.map((standard) => [standard.standardId, standard]));
      const bankStandards = Array.isArray(state.selectedStandardsBank?.standards) ? state.selectedStandardsBank.standards : [];
      const bankItems = bankStandards.map((standard) => ({
        ...standard,
        ...(draftById.get(standard.standardId) || {}),
        bankMatch: true,
        usedInDraft: draftById.has(standard.standardId)
      }));
      const bankIds = new Set(bankItems.map((standard) => standard.standardId));
      const draftOnlyItems = draftStandards
        .filter((standard) => !bankIds.has(standard.standardId))
        .map((standard) => ({ ...standard, usedInDraft: true, bankMatch: Boolean(standard.bankMatch) }));
      return [...bankItems, ...draftOnlyItems];
    }

    function filterStandardsPreviewItems(standards) {
      const search = normalizeSearchText(state.standardsSearch);
      return standards.filter((standard) => {
        if (state.standardsStrandFilter && standard.strand !== state.standardsStrandFilter) return false;
        if (state.standardsTopicFilter && standard.topic !== state.standardsTopicFilter) return false;
        if (state.standardsMatchFilter === 'used' && !standard.usedInDraft) return false;
        if (state.standardsMatchFilter === 'unknown' && standard.bankMatch && standard.usedInDraft) return false;
        if (!search) return true;
        return normalizeSearchText([
          standard.standardId,
          standard.code,
          standard.title,
          standard.officialText,
          standard.studentFriendlyText,
          standard.strand,
          standard.topic,
          ...(Array.isArray(standard.keywords) ? standard.keywords : [])
        ].join(' ')).includes(search);
      });
    }

    function getStandardMatchStatus(standard) {
      if (standard.usedInDraft && standard.bankMatch) return { label: 'Used in this draft', className: 'used' };
      if (standard.usedInDraft && !standard.bankMatch) return { label: 'Unknown in selected bank', className: 'unknown' };
      return { label: 'Not used in this draft', className: 'unused' };
    }

    function selectVisibleStandard(standards) {
      if (!standards.length) return null;
      return standards.find((standard) => standard.standardId === state.selectedStandardId) || standards[0];
    }

    function uniqueStandardValues(standards, field) {
      return Array.from(new Set(standards.map((standard) => standard[field]).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
    }

    function normalizeSearchText(value) {
      return String(value || '').trim().toLowerCase();
    }

    function formatStandardsBankOptionLabel(bank) {
      const parts = [
        bank.title || bank.standardsBankId || 'Untitled standards set',
        bank.subject,
        bank.gradeLevel ? `Grade ${bank.gradeLevel}` : '',
        bank.jurisdiction
      ].filter(Boolean);
      return parts.join(' - ');
    }

    return {
      selectStandardsBank,
      renderStandardsCard,
      renderStandardsTools,
      renderStandardsFilters,
      renderStandardsPlaceholders,
      renderStandardsBankOptions,
      renderSelectedStandardsBankSummary,
      renderStandardCard,
      renderStandardDetailPanel,
      buildStandardsPreviewItems,
      filterStandardsPreviewItems,
      getStandardMatchStatus,
      selectVisibleStandard,
      uniqueStandardValues,
      normalizeSearchText,
      formatStandardsBankOptionLabel
    };
  }

  ns.createStandardsPanelModule = createStandardsPanelModule;
})();
