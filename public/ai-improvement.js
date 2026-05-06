(() => {
  const state = {
    problems: []
  };

  function init() {
    bindEvents();
    loadProblems();
  }

  function bindEvents() {
    document.getElementById('aiRefreshProblems')?.addEventListener('click', loadProblems);
    document.getElementById('aiCopyGeneralPrompt')?.addEventListener('click', copyGeneralFixPrompt);
    document.getElementById('flagAnswerButton')?.addEventListener('click', flagCurrentAnswer);
    document.getElementById('aiProblemList')?.addEventListener('click', handleProblemAction);
  }

  async function fetchJson(url, options = {}) {
    return window.Charlemagne.api.fetchJson(url, options);
  }

  async function loadProblems() {
    const status = document.getElementById('aiImprovementStatus');
    setStatus('Loading problems...');

    try {
      const data = await fetchJson('/api/ai-improvement/problems');
      state.problems = Array.isArray(data.problems) ? data.problems : [];
      renderProblems();
      setStatus(`Loaded ${state.problems.length} problem${state.problems.length === 1 ? '' : 's'}.`);
    } catch (error) {
      if (status) status.textContent = 'Could not load problem log.';
    }
  }

  async function flagCurrentAnswer(event) {
    const button = event?.currentTarget || null;
    const getter = window.CharlemagneGetLastInteraction;
    const interaction = typeof getter === 'function'
      ? getter()
      : window.CharlemagneLastInteraction;

    if (!interaction || !interaction.studentQuestion || !interaction.answerGiven) {
      if (button) temporarilyLabel(button, 'No answer yet');
      setStatus('No answer to flag yet.');
      return;
    }

    try {
      await fetchJson('/api/ai-improvement/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'open',
          category: 'teacher_flagged',
          source: 'manual',
          reason: 'teacher_flagged',
          studentQuestion: interaction.studentQuestion,
          answerGiven: interaction.answerGiven,
          routerType: interaction.routerType || '',
          formulaChosen: interaction.formulaChosen || '',
          confidence: interaction.confidence || '',
          teacherNotes: 'Manually flagged by teacher for review.',
          debug: interaction.debug || {}
        })
      });

      if (button) temporarilyLabel(button, 'Flagged');
      setStatus('Flagged for AI Improvement');
      await loadProblems();
    } catch (error) {
      setStatus(error.message || 'Could not flag the answer.');
    }
  }

  async function handleProblemAction(event) {
    const button = event.target.closest('[data-ai-action]');
    if (!button) return;

    const problem = state.problems.find((item) => item.id === button.dataset.problemId);
    if (!problem) return;

    const action = button.dataset.aiAction;

    if (action === 'resolved') {
      await patchProblem(problem.id, { status: 'resolved' });
      return;
    }

    if (action === 'ignored') {
      await patchProblem(problem.id, { status: 'ignored' });
      return;
    }

    if (action === 'copy-fix') {
      await copyToClipboard(buildFixPrompt(problem), button, 'Copied fix prompt');
      return;
    }

    if (action === 'copy-test') {
      await copyToClipboard(buildTestPrompt(problem), button, 'Copied test prompt');
      return;
    }

    if (action === 'copy-debug') {
      await copyToClipboard(buildDebugSummary(problem), button, 'Copied debug summary');
      return;
    }

    if (action === 'save-notes') {
      const card = button.closest('.problem-card');
      await patchProblem(problem.id, {
        expectedBehavior: card?.querySelector('[data-ai-field="expectedBehavior"]')?.value || '',
        teacherNotes: card?.querySelector('[data-ai-field="teacherNotes"]')?.value || ''
      });
      return;
    }

    if (action === 'category') {
      const category = button.dataset.category || '';
      if (category) {
        await patchProblem(problem.id, { category });
      }
    }
  }

  async function patchProblem(id, changes) {
    try {
      await fetchJson(`/api/ai-improvement/problems/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });
      await loadProblems();
    } catch (error) {
      setStatus(error.message || 'Could not update problem.');
    }
  }

  function renderProblems() {
    const list = document.getElementById('aiProblemList');
    if (!list) return;

    const sortedProblems = sortProblems(state.problems);
    const openCount = state.problems.filter((problem) => problem.status === 'open' || problem.status === 'needs_review').length;
    const resolvedCount = state.problems.filter((problem) => problem.status === 'resolved').length;
    const ignoredCount = state.problems.filter((problem) => problem.status === 'ignored').length;

    setText('aiOpenProblems', openCount);
    setText('aiResolvedProblems', resolvedCount);
    setText('aiIgnoredProblems', ignoredCount);
    setText('aiTotalProblems', state.problems.length);

    if (!state.problems.length) {
      list.innerHTML = '<p class="history-empty">No AI improvement problems logged yet.</p>';
      return;
    }

    list.innerHTML = sortedProblems.map(renderProblemCard).join('');
  }

  function sortProblems(problems) {
    const order = {
      open: 0,
      needs_review: 1,
      resolved: 2,
      ignored: 3
    };

    return problems.slice().sort((a, b) => {
      const aStatus = order[a.status] ?? 1;
      const bStatus = order[b.status] ?? 1;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  function renderProblemCard(problem) {
    const status = problem.status || 'open';
    const cardStatusClass = `problem-card-${status === 'needs_review' ? 'open' : status}`;
    const created = problem.createdAt ? new Date(problem.createdAt).toLocaleString() : '';

    return `
      <article class="problem-card ai-problem-card ${escapeAttr(status)} ${escapeAttr(cardStatusClass)}">
        <div class="ai-problem-head">
          <span class="ai-status-label ${escapeAttr(status)}">${displayValue(status)}</span>
          <span class="ai-category-label">${displayValue(problem.category || 'needs_review')}</span>
          <span class="ai-problem-date">${displayValue(created)}</span>
        </div>

        <dl class="ai-problem-fields">
          ${field('Student Question', problem.studentQuestion)}
          ${field('What Charlemagne Answered', problem.answerGiven)}
          ${field('Router Type', problem.routerType)}
          ${field('Formula Chosen', problem.formulaChosen)}
          ${field('Confidence', problem.confidence)}
          ${field('Source', problem.source)}
          ${field('Reason', problem.reason)}
          ${field('Seen Count', problem.count)}
          ${field('Last Seen', formatDate(problem.lastSeenAt))}
        </dl>

        <div class="ai-edit-fields">
          <label>
            <span>Expected Behavior</span>
            <textarea data-ai-field="expectedBehavior" data-problem-id="${escapeAttr(problem.id)}" rows="3" placeholder="Not recorded">${escapeHtml(problem.expectedBehavior || '')}</textarea>
          </label>
          <label>
            <span>Teacher Notes</span>
            <textarea data-ai-field="teacherNotes" data-problem-id="${escapeAttr(problem.id)}" rows="3" placeholder="Not recorded">${escapeHtml(problem.teacherNotes || '')}</textarea>
          </label>
        </div>

        <div class="ai-category-actions" aria-label="Problem category shortcuts">
          ${categoryButton(problem, 'formula_bug', 'Formula Bug')}
          ${categoryButton(problem, 'teacher_fact_needed', 'Teacher Fact Needed')}
          ${categoryButton(problem, 'reject_rule_needed', 'Reject Rule Needed')}
          ${categoryButton(problem, 'ui_issue', 'UI Issue')}
          ${categoryButton(problem, 'voice_issue', 'Voice Issue')}
        </div>

        <div class="problem-actions ai-card-actions">
          <button type="button" class="small-button secondary-small" data-ai-action="copy-fix" data-problem-id="${escapeAttr(problem.id)}">Copy Fix Prompt</button>
          <button type="button" class="small-button secondary-small" data-ai-action="copy-test" data-problem-id="${escapeAttr(problem.id)}">Copy Test Prompt</button>
          <button type="button" class="small-button secondary-small" data-ai-action="copy-debug" data-problem-id="${escapeAttr(problem.id)}">Copy Debug Summary</button>
          <button type="button" class="small-button secondary-small" data-ai-action="save-notes" data-problem-id="${escapeAttr(problem.id)}">Save Notes</button>
          <button type="button" class="small-button secondary-small" data-ai-action="resolved" data-problem-id="${escapeAttr(problem.id)}">Mark Resolved</button>
          <button type="button" class="small-button secondary-small" data-ai-action="ignored" data-problem-id="${escapeAttr(problem.id)}">Ignore</button>
        </div>
      </article>
    `;
  }

  function categoryButton(problem, category, label) {
    const isActive = problem.category === category;
    return `
      <button
        type="button"
        class="ai-category-button ${isActive ? 'active' : ''}"
        data-ai-action="category"
        data-category="${escapeAttr(category)}"
        data-problem-id="${escapeAttr(problem.id)}"
      >${escapeHtml(label)}</button>
    `;
  }

  function field(label, value) {
    const clean = String(value || '').trim();
    const missing = !clean;

    return `
      <div class="ai-field-row">
        <dt>${escapeHtml(label)}</dt>
        <dd class="${missing ? 'ai-field-empty' : ''}">${escapeHtml(missing ? 'Not recorded' : clean)}</dd>
      </div>
    `;
  }

  async function copyGeneralFixPrompt() {
    const openProblems = state.problems.filter((problem) => problem.status !== 'resolved' && problem.status !== 'ignored');
    const prompt = [
      'You are helping me improve my local classroom science tutor called Charlemagne / AI in a Box.',
      '',
      'Important background:',
      '- This is a local Node.js app running on a Raspberry Pi.',
      '- It should prefer deterministic rule-based formula routing over AI.',
      '- The goal is short, accurate 9th-grade physical science answers.',
      '- Do not use Ollama for formula questions unless the router cannot safely solve them.',
      '- Main files likely involved:',
      '  - lib/router/questionRouter.js',
      '  - lib/formulas/scienceFormulaTools.js',
      '  - tests/routerTestBank.js (test cases only)',
      '',
      ...testCommandNotes(),
      '',
      `There are ${openProblems.length} open or needs-review problems in the AI Improvement log.`,
      '',
      'Please review the problem log, add regression tests before patches, run npm run test:all for the full check, and avoid weakening existing passing tests.'
    ].join('\n');

    await copyToClipboard(prompt, document.getElementById('aiCopyGeneralPrompt'), 'Copied general fix prompt');
  }

  function buildFixPrompt(problem) {
    return [
      'You are helping me fix my local classroom science tutor called Charlemagne / AI in a Box.',
      '',
      'Important background:',
      '- This is a local Node.js app running on a Raspberry Pi.',
      '- It should prefer deterministic rule-based formula routing over AI.',
      '- The goal is short, accurate 9th-grade physical science answers.',
      '- Do not make answers longer than needed.',
      '- Do not use Ollama for formula questions unless the router cannot safely solve them.',
      '- Main files likely involved:',
      '  - lib/router/questionRouter.js',
      '  - lib/formulas/scienceFormulaTools.js',
      '  - tests/routerTestBank.js (test cases only)',
      '  - lib/knowledge/teacherFacts.js or other knowledge files if this is a teacher-fact issue',
      '',
      ...testCommandNotes(),
      '',
      'Problem:',
      'The student asked:',
      quoteForPrompt(problem.studentQuestion),
      '',
      'Charlemagne answered:',
      quoteForPrompt(problem.answerGiven),
      '',
      'Router/debug info:',
      `- routerType: ${safeText(problem.routerType)}`,
      `- formulaChosen: ${safeText(problem.formulaChosen)}`,
      `- confidence: ${safeText(problem.confidence)}`,
      `- category: ${safeText(problem.category)}`,
      `- status: ${safeText(problem.status)}`,
      `- source: ${safeText(problem.source)}`,
      `- reason: ${safeText(problem.reason)}`,
      `- count: ${safeText(problem.count)}`,
      `- lastSeenAt: ${safeText(problem.lastSeenAt)}`,
      `- debug: ${formatDebug(problem.debug)}`,
      '',
      'Teacher notes:',
      quoteForPrompt(problem.teacherNotes),
      '',
      'Expected behavior:',
      quoteForPrompt(problem.expectedBehavior),
      '',
      'Fix requirements:',
      '1. Add this exact question to the router test bank first if it is a formula/router bug.',
      '2. If this is a teacher-fact issue, add a trusted teacher fact or knowledge-base entry instead of forcing the router.',
      '3. Patch the smallest safe part of the router, formula parser, or teacher facts.',
      '4. Run the full router test bank:',
      '   npm run test:bank',
      '5. Do not weaken existing passing tests.',
      '6. Keep the final student answer short and 9th-grade appropriate.',
      '7. Run npm run test:all for the full router check before calling the fix done.',
      '8. If the app cannot safely answer the question, it should reject or ask for clarification instead of guessing.',
      '',
      'Please give me the safest code patch.'
    ].join('\n');
  }

  function buildTestPrompt(problem) {
    return [
      'I need to add a regression test to my local classroom science tutor.',
      '',
      'The app uses a router test bank at:',
      'tests/routerTestBank.js',
      '',
      ...testCommandNotes(),
      '',
      'Failed or unanswered question:',
      quoteForPrompt(problem.studentQuestion),
      '',
      'Charlemagne answered:',
      quoteForPrompt(problem.answerGiven),
      '',
      'Expected behavior:',
      quoteForPrompt(problem.expectedBehavior),
      '',
      'Teacher notes:',
      quoteForPrompt(problem.teacherNotes),
      '',
      'Router/debug info:',
      `- routerType: ${safeText(problem.routerType)}`,
      `- formulaChosen: ${safeText(problem.formulaChosen)}`,
      `- confidence: ${safeText(problem.confidence)}`,
      `- category: ${safeText(problem.category)}`,
      `- source: ${safeText(problem.source)}`,
      `- reason: ${safeText(problem.reason)}`,
      `- debug: ${formatDebug(problem.debug)}`,
      '',
      'Please write only the smallest useful test-bank patch needed.',
      'Run npm run test:bank to validate the big teacher test bank, then npm run test:all for the full check.',
      'Do not rewrite the router in this response.'
    ].join('\n');
  }

  function buildDebugSummary(problem) {
    return [
      'AI Improvement Debug Summary',
      '',
      ...testCommandNotes(),
      '',
      'ID:',
      safeText(problem.id),
      '',
      'Created:',
      safeText(problem.createdAt),
      '',
      'Status:',
      safeText(problem.status),
      '',
      'Category:',
      safeText(problem.category),
      '',
      'Source:',
      safeText(problem.source),
      '',
      'Reason:',
      safeText(problem.reason),
      '',
      'Count:',
      safeText(problem.count),
      '',
      'Last Seen:',
      safeText(problem.lastSeenAt),
      '',
      'Student Question:',
      safeText(problem.studentQuestion),
      '',
      'Answer Given:',
      safeText(problem.answerGiven),
      '',
      'Router Type:',
      safeText(problem.routerType),
      '',
      'Formula Chosen:',
      safeText(problem.formulaChosen),
      '',
      'Confidence:',
      safeText(problem.confidence),
      '',
      'Expected Behavior:',
      safeText(problem.expectedBehavior),
      '',
      'Teacher Notes:',
      safeText(problem.teacherNotes),
      '',
      'Debug:',
      formatDebug(problem.debug)
    ].join('\n');
  }

  function testCommandNotes() {
    return [
      'Test command notes:',
      '- tests/routerTestBank.js is where the router test cases live; it is not the runner.',
      '- scripts/test-router-bank.js is the runner for the big teacher test bank.',
      '- npm run test:bank runs the big teacher test bank.',
      '- npm run test:all runs both the small router tests and the big teacher test bank.'
    ];
  }

  function safeText(value) {
    if (value === undefined || value === null) return 'Not recorded';
    const clean = String(value).trim();
    return clean || 'Not recorded';
  }

  function quoteForPrompt(value) {
    return `"${safeText(value)}"`;
  }

  function formatDebug(debug) {
    if (debug === undefined || debug === null || debug === '') return 'Not recorded';

    if (typeof debug === 'string') {
      return debug.trim() || 'Not recorded';
    }

    if (typeof debug === 'object' && !Object.keys(debug).length) {
      return 'Not recorded';
    }

    try {
      return JSON.stringify(debug, null, 2);
    } catch {
      return 'Not recorded';
    }
  }

  function displayValue(value) {
    const clean = String(value || '').trim();
    return escapeHtml(clean || 'Not recorded');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  async function copyToClipboard(text, button, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
      if (button) temporarilyLabel(button, 'Copied!');
      setStatus(successMessage);
    } catch {
      showClipboardFallback(text);
      setStatus('Clipboard blocked. Prompt shown below for manual copy.');
    }
  }

  function showClipboardFallback(text) {
    let fallback = document.getElementById('aiClipboardFallback');

    if (!fallback) {
      fallback = document.createElement('textarea');
      fallback.id = 'aiClipboardFallback';
      fallback.className = 'ai-clipboard-fallback';
      fallback.setAttribute('aria-label', 'Manual copy prompt text');

      const status = document.getElementById('aiImprovementStatus');
      status?.insertAdjacentElement('afterend', fallback);
    }

    fallback.value = text;
    fallback.hidden = false;
    fallback.focus();
    fallback.select();
  }

  function temporarilyLabel(button, text) {
    const original = button.textContent;
    button.textContent = text;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1200);
  }

  function setStatus(text) {
    setText('aiImprovementStatus', text);
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(text);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/\s+/g, '-');
  }

  window.CharlemagneAiImprovement = {
    refresh: loadProblems
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
