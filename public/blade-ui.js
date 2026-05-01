(() => {
  const BLADE_KEY = 'charlemagneBladeActive';
  const bladeDefs = [
    {
      id: 'voice',
      label: 'Voice Setup',
      short: 'VOICE SETUP',
      icon: '🎙',
      body: `
        <div class="blade-placeholder-card">
          <h3>Voice Setup</h3>
          <p>Teacher voice training will live here.</p>
          <p>For now this is a placeholder blade so the blade UI and sliding mechanic are in place.</p>
        </div>
      `
    },
    {
      id: 'profiles',
      label: 'Profiles',
      short: 'PROFILES',
      icon: '👤',
      body: `
        <div class="blade-placeholder-card">
          <h3>Profiles</h3>
          <p>Teacher profiles will live here.</p>
          <p>No student voice tracking. Teacher profiles only.</p>
        </div>
      `
    },
    {
      id: 'main',
      label: 'Main',
      short: 'MAIN',
      icon: '⌂',
      body: ''
    },
    {
      id: 'commands',
      label: 'Commands',
      short: 'COMMANDS',
      icon: '>_',
      body: `
        <div class="blade-placeholder-card">
          <h3>Commands</h3>
          <p>Built-in assistant commands will live here.</p>
          <ul>
            <li>stop talking</li>
            <li>clear screen</li>
            <li>reload teacher facts</li>
            <li>lock classroom voice</li>
            <li>unlock classroom voice</li>
            <li>shutdown assistant</li>
          </ul>
        </div>
      `
    },
    {
      id: 'ai-improvement',
      label: 'AI Improvement',
      short: 'AI IMPROVEMENT',
      icon: 'AI',
      body: `
        <section class="ai-improvement-panel ai-improvement-shell" aria-label="AI Improvement problem review">
          <div class="ai-improvement-summary ai-improvement-toolbar">
            <div class="ai-summary-card">
              <span>Open Problems</span>
              <strong id="aiOpenProblems">0</strong>
            </div>
            <div class="ai-summary-card">
              <span>Resolved Problems</span>
              <strong id="aiResolvedProblems">0</strong>
            </div>
            <div class="ai-summary-card">
              <span>Ignored Problems</span>
              <strong id="aiIgnoredProblems">0</strong>
            </div>
            <div class="ai-summary-card">
              <span>Total Problems</span>
              <strong id="aiTotalProblems">0</strong>
            </div>
          </div>

          <div class="ai-improvement-actions">
            <button type="button" id="aiRefreshProblems" class="small-button">Refresh Problems</button>
            <button type="button" id="aiCopyGeneralPrompt" class="small-button secondary-small">Copy General Fix Prompt</button>
          </div>

          <p id="aiImprovementStatus" class="ai-improvement-status">Ready.</p>
          <div id="aiProblemList" class="ai-problem-list">
            <p class="history-empty">No AI improvement problems logged yet.</p>
          </div>
        </section>
      `
    },
    {
      // Keep the internal "modes" id so saved blade state and existing CSS accents keep working.
      id: 'modes',
      label: 'Teacher Profile',
      short: 'PROFILE',
      icon: 'ID',
      body: `
        <section class="teacher-profile-panel" aria-label="Teacher Profile">
          <div class="teacher-profile-top">
            <div>
              <h3>Teacher Profile</h3>
              <p>Connect a teacher Gmail account to unlock profile details and daily report tools.</p>
            </div>
            <div class="gmail-connection-card">
              <button type="button" id="profileConnectGoogleButton" class="small-button" disabled>Connect Gmail</button>
              <span id="profileConnectionMessage">Google sign-in is not connected yet.</span>
            </div>
          </div>

          <div class="teacher-profile-grid">
            <section class="teacher-profile-card teacher-identity-card">
              <div id="profileAvatar" class="teacher-avatar-placeholder" aria-hidden="true">TP</div>
              <div class="teacher-profile-copy">
                <span id="profileStatusPill" class="profile-status-pill">Not signed in</span>
                <h4>Teacher profile</h4>
                <p id="profileHelpText">Connect Gmail to show teacher profile information.</p>
              </div>
              <dl class="teacher-profile-fields">
                <div>
                  <dt>Email</dt>
                  <dd id="profileEmail">Not signed in</dd>
                </div>
                <div>
                  <dt>First Name</dt>
                  <dd id="profileFirstName">Not available</dd>
                </div>
                <div>
                  <dt>Last Name</dt>
                  <dd id="profileLastName">Not available</dd>
                </div>
              </dl>
            </section>

            <section class="teacher-profile-card daily-date-card">
              <label for="profileDateSelect">Daily Summary Date</label>
              <select id="profileDateSelect" disabled>
                <option>Today</option>
                <option>No activity dates loaded yet</option>
              </select>
              <button type="button" id="profileRefreshSummary" class="small-button secondary-small">Refresh Summary</button>
              <span id="profileDateStatus">No activity dates loaded yet.</span>
            </section>

            <section class="teacher-profile-card student-link-card">
              <h4>Student Link</h4>
              <p>Create a local student help page for this classroom session.</p>
              <button type="button" id="profileCreateStudentLink" class="small-button">Create Student Link</button>
              <div id="profileStudentLinkPanel" class="profile-student-link-panel" hidden>
                <a id="profileStudentUrl" href="#" target="_blank" rel="noreferrer"></a>
                <button type="button" id="profileCopyStudentLink" class="small-button secondary-small">Copy</button>
              </div>
              <span id="profileStudentLinkStatus">No student link created yet.</span>
              <div class="profile-student-session-list" aria-label="Active student sessions">
                <div class="profile-student-session-head">
                  <strong>Active Sessions</strong>
                  <span id="profileStudentSessionCount">0 active</span>
                </div>
                <div id="profileStudentSessions" class="profile-student-session-rows">
                  <p class="profile-empty-state">No active student sessions yet.</p>
                </div>
              </div>
            </section>
          </div>

          <section class="teacher-profile-card question-rundown-card">
            <div class="profile-section-head">
              <h4>Daily Question Rundown</h4>
              <span id="profileSummaryStatus">No question activity loaded yet.</span>
              <strong id="profileTotalQuestions">0 questions</strong>
            </div>
            <div class="profile-table-shell" role="table" aria-label="Daily question activity placeholder">
              <div class="profile-table-head" role="row">
                <span role="columnheader">Time</span>
                <span role="columnheader">Topic</span>
                <span role="columnheader">Question</span>
                <span role="columnheader">Response Preview</span>
                <span role="columnheader">Route/Type</span>
                <span role="columnheader">Confidence</span>
              </div>
              <div id="profileQuestionRows" class="profile-table-body">
                <p class="profile-empty-state" role="row">No question activity loaded yet.</p>
              </div>
            </div>
          </section>

          <div class="teacher-profile-grid">
            <section class="teacher-profile-card topic-summary-card">
              <h4>Topic Summary</h4>
              <div id="profileTopicSummary" class="topic-summary-placeholder">
                <span class="topic-ring-placeholder" aria-hidden="true"></span>
                <p>Topic summary will appear here after question activity is available.</p>
              </div>
            </section>

            <section class="teacher-profile-card daily-email-card">
              <h4>Daily Email Report</h4>
              <p>Daily email reports will summarize question topics and common student needs.</p>
              <button type="button" id="profileSendDailyEmail" class="small-button secondary-small" disabled>Send daily summary email</button>
              <span id="profileEmailNotice">Connect Gmail before sending daily reports.</span>
            </section>
          </div>
        </section>
      `
    },
    {
      id: 'system',
      label: 'System',
      short: 'SYSTEM',
      icon: '⚙',
      body: `

        <section class="system-health-panel">
          <div class="system-health-top">
            <div>
              <h3>System Health</h3>
              <p>This panel checks whether Charlemagne’s local services are ready.</p>
            </div>
            <div class="system-health-buttons">
              <button type="button" id="systemRefreshHealth" class="small-button">Refresh Health</button>
              <button type="button" id="systemCheckMic" class="small-button secondary-small">Check Mic Permission</button>
            </div>
          </div>

          <div class="system-health-summary">
            <div class="system-count-card good">
              <span>Green</span>
              <strong id="systemGreenCount">0</strong>
            </div>
            <div class="system-count-card warn">
              <span>Yellow</span>
              <strong id="systemYellowCount">0</strong>
            </div>
            <div class="system-count-card bad">
              <span>Red</span>
              <strong id="systemRedCount">0</strong>
            </div>
          </div>

          <p id="systemHealthStatus" class="system-health-status">Waiting to check system health.</p>
          <p id="systemHealthChecked" class="system-health-checked">Last checked: not yet.</p>

          <div class="system-health-grid">
            <section class="system-health-group">
              <h4>Server</h4>
              <div id="systemServerChecks" class="system-check-list"></div>
            </section>

            <section class="system-health-group">
              <h4>Ollama</h4>
              <div id="systemOllamaChecks" class="system-check-list"></div>
            </section>

            <section class="system-health-group">
              <h4>Piper / Voice</h4>
              <div id="systemPiperChecks" class="system-check-list"></div>
            </section>

            <section class="system-health-group">
              <h4>Files / Logs</h4>
              <div id="systemFileChecks" class="system-check-list"></div>
            </section>

            <section class="system-health-group">
              <h4>Browser</h4>
              <div id="systemBrowserChecks" class="system-check-list"></div>
            </section>
          </div>
        </section>

      `
    }
  ];

  function getActiveIndex() {
    const saved = localStorage.getItem(BLADE_KEY);
    const idx = bladeDefs.findIndex((blade) => blade.id === saved);
    return idx >= 0 ? idx : 2;
  }

  function setActiveIndex(idx) {
    localStorage.setItem(BLADE_KEY, bladeDefs[idx].id);
  }

  function buildShell(appRoot) {
    const shell = document.createElement('div');
    shell.id = 'bladeUiShell';
    shell.className = 'blade-ui-shell';

    shell.innerHTML = `
      <div class="blade-stage-shell">
        <div class="blade-side-frame blade-side-frame-left"></div>
        <div class="blade-side-frame blade-side-frame-right"></div>

        <button class="blade-arrow blade-arrow-left" type="button" aria-label="Previous blade">‹</button>

        <div class="blade-preview-rail blade-preview-rail-left" id="bladeLeftRail"></div>

        <div class="blade-center-stage">
          <div class="blade-center-halo"></div>
          <div class="blade-center-panel" id="bladeCenterPanel"></div>
        </div>

        <div class="blade-preview-rail blade-preview-rail-right" id="bladeRightRail"></div>

        <button class="blade-arrow blade-arrow-right" type="button" aria-label="Next blade">›</button>
      </div>

      <nav class="blade-bottom-nav" id="bladeBottomNav"></nav>
    `;

    const center = shell.querySelector('#bladeCenterPanel');

    bladeDefs.forEach((blade) => {
      const page = document.createElement('section');
      page.className = 'blade-page';
      page.dataset.bladePage = blade.id;

      if (blade.id === 'main') {
        const header = document.createElement('div');
        header.className = 'blade-page-title';
        header.textContent = 'Main';
        page.appendChild(header);

        const contentWrap = document.createElement('div');
        contentWrap.className = 'blade-main-content-wrap';
        contentWrap.appendChild(appRoot);
        page.appendChild(contentWrap);
      } else {
        page.innerHTML = `
          <div class="blade-page-title">${blade.label}</div>
          <div class="blade-page-body">${blade.body}</div>
        `;
      }

      center.appendChild(page);
    });

    document.body.innerHTML = '';
    document.body.appendChild(shell);
  }

  function buildBottomNav(activeIndex) {
    const nav = document.getElementById('bladeBottomNav');
    if (!nav) return;

    nav.innerHTML = `
      <button class="blade-nav-arrow" data-blade-shift="-1" type="button">‹</button>
      ${bladeDefs.map((blade, index) => `
        <button
          class="blade-nav-item ${index === activeIndex ? 'active' : ''}"
          data-blade-index="${index}"
          type="button"
        >
          <span class="blade-nav-icon">${blade.icon}</span>
          <span class="blade-nav-label">${blade.label}</span>
        </button>
      `).join('')}
      <button class="blade-nav-arrow" data-blade-shift="1" type="button">›</button>
    `;
  }

  function makePreviewBlade(blade, index, activeIndex, side) {
    const btn = document.createElement('button');
    btn.className = `blade-preview ${side}`;
    btn.dataset.bladeIndex = index;

    const distance = Math.abs(index - activeIndex);
    btn.style.setProperty('--preview-depth', String(distance));

    btn.innerHTML = `
      <div class="blade-preview-inner">
        <div class="blade-preview-title">${blade.short}</div>
        <div class="blade-preview-icon">${blade.icon}</div>
        <div class="blade-preview-accent ${blade.id}"></div>
      </div>
    `;
    return btn;
  }

  function render(activeIndex) {
    setActiveIndex(activeIndex);

    document.querySelectorAll('.blade-page').forEach((page, idx) => {
      page.classList.toggle('active', idx === activeIndex);
    });

    const leftRail = document.getElementById('bladeLeftRail');
    const rightRail = document.getElementById('bladeRightRail');
    if (leftRail) leftRail.innerHTML = '';
    if (rightRail) rightRail.innerHTML = '';

    const leftItems = bladeDefs
      .map((blade, idx) => ({ blade, idx }))
      .filter((item) => item.idx < activeIndex);

    const rightItems = bladeDefs
      .map((blade, idx) => ({ blade, idx }))
      .filter((item) => item.idx > activeIndex);

    leftItems.forEach((item) => {
      leftRail.appendChild(makePreviewBlade(item.blade, item.idx, activeIndex, 'left'));
    });

    rightItems.forEach((item) => {
      rightRail.appendChild(makePreviewBlade(item.blade, item.idx, activeIndex, 'right'));
    });

    buildBottomNav(activeIndex);

    document.querySelectorAll('[data-blade-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.bladeIndex);
        if (!Number.isNaN(idx)) render(idx);
      });
    });

    document.querySelectorAll('[data-blade-shift]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shift = Number(btn.dataset.bladeShift);
        const next = Math.max(0, Math.min(bladeDefs.length - 1, activeIndex + shift));
        render(next);
      });
    });

    document.querySelector('.blade-arrow-left')?.addEventListener('click', () => {
      render(Math.max(0, activeIndex - 1));
    });

    document.querySelector('.blade-arrow-right')?.addEventListener('click', () => {
      render(Math.min(bladeDefs.length - 1, activeIndex + 1));
    });

    document.dispatchEvent(new CustomEvent('charlemagne:blade-active', {
      detail: {
        id: bladeDefs[activeIndex]?.id || '',
        label: bladeDefs[activeIndex]?.label || ''
      }
    }));
  }

  function initBladeUi() {
    if (document.getElementById('bladeUiShell')) return;

    const appRoot =
      document.querySelector('main') ||
      document.querySelector('.app-shell') ||
      document.querySelector('.container') ||
      document.querySelector('.page-shell') ||
      document.body.firstElementChild;

    if (!appRoot) return;

    buildShell(appRoot);
    render(getActiveIndex());

    document.addEventListener('keydown', (event) => {
      const current = getActiveIndex();
      if (event.key === 'ArrowLeft') {
        render(Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight') {
        render(Math.min(bladeDefs.length - 1, current + 1));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBladeUi);
  } else {
    initBladeUi();
  }
})();
