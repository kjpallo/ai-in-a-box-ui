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
              <p>Local teacher login is used every day. Google is optional for email and identity features.</p>
            </div>
            <div class="gmail-connection-card">
              <button type="button" id="profileConnectGoogleButton" class="small-button" disabled>Connect Google</button>
              <button type="button" id="profileDisconnectGoogleButton" class="small-button secondary-small" hidden>Disconnect Google</button>
              <span id="profileConnectionMessage">Google sign-in is not connected yet.</span>
            </div>
          </div>

          <div class="teacher-profile-grid">
            <section class="teacher-profile-card teacher-identity-card">
              <div id="profileAvatar" class="teacher-avatar-placeholder" aria-hidden="true">TP</div>
              <div class="teacher-profile-copy">
                <span id="profileStatusPill" class="profile-status-pill">Not signed in</span>
                <h4>Teacher profile</h4>
                <p id="profileHelpText">Google can be connected later for email and identity features.</p>
              </div>
              <dl class="teacher-profile-fields">
                <div>
                  <dt>Local Username</dt>
                  <dd id="profileLocalUsername">Not available</dd>
                </div>
                <div>
                  <dt>Google Status</dt>
                  <dd id="profileGoogleStatus">Not connected</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd id="profileEmail">Not signed in</dd>
                </div>
                <div>
                  <dt>Google Name</dt>
                  <dd id="profileGoogleName">Not available</dd>
                </div>
              </dl>
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
        </section>
      `
    },

    {
      id: 'live-activity',
      label: 'Live Activity',
      short: 'LIVE',
      icon: '📡',
      body: renderLiveActivityBlade()
    },

    {
      id: 'reports',
      label: 'Reports',
      short: 'REPORTS',
      icon: '📊',
      body: renderReportsBlade()
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

  function renderLiveActivityBlade() {
    return `
        <section class="live-activity-panel" aria-label="Live Activity">
          <div class="live-activity-header">
            <div>
              <h3>Live Activity</h3>
              <p>See what students are asking right now and what needs attention.</p>
            </div>
            <div class="live-activity-controls">
              <label class="sr-only" for="profileDateSelect">Activity date</label>
              <select id="profileDateSelect" disabled>
                <option>Today</option>
                <option>No activity dates loaded yet</option>
              </select>
              <button type="button" id="profileRefreshSummary" class="small-button secondary-small">Refresh</button>
            </div>
          </div>

          <span id="profileDateStatus" class="live-activity-date-status">No activity dates loaded yet.</span>

          <div class="live-summary-grid" aria-label="Live activity summary">
            <section class="live-summary-card">
              <span class="live-summary-icon" aria-hidden="true">?</span>
              <div>
                <span>Total questions</span>
                <strong id="profileTotalQuestions">0</strong>
              </div>
            </section>
            <section class="live-summary-card attention">
              <span class="live-summary-icon" aria-hidden="true">!</span>
              <div>
                <span>Needs review</span>
                <strong id="profileNeedsReviewValue">0</strong>
              </div>
            </section>
            <section class="live-summary-card">
              <span class="live-summary-icon" aria-hidden="true">#</span>
              <div>
                <span>Top topic</span>
                <strong id="profileTopTopicValue">-</strong>
              </div>
            </section>
            <section class="live-summary-card">
              <span class="live-summary-icon" aria-hidden="true">✓</span>
              <div>
                <span>Standards tagged</span>
                <strong id="liveStandardsTaggedValue">0</strong>
              </div>
            </section>
          </div>

          <section class="live-attention-card" aria-label="Needs teacher attention">
            <div class="live-attention-head">
              <h4>Needs Teacher Attention</h4>
              <button type="button" id="profileReviewQuestions" class="small-button secondary-small">Review Questions</button>
            </div>
            <div class="live-attention-list">
              <p><span aria-hidden="true"></span><strong id="profileNoMatchAttention">0 no-match questions need review</strong></p>
              <p><span aria-hidden="true"></span><strong id="profileMissingStandardsAttention">0 questions missing standards tags</strong></p>
              <p><span aria-hidden="true"></span><strong id="profileCommonTopicAttention">Most common topic: none yet</strong></p>
            </div>
          </section>

          <section class="recent-questions-card">
            <div class="profile-section-head">
              <div>
                <h4>Recent Questions</h4>
                <span id="profileSummaryStatus">No question activity loaded yet.</span>
              </div>
            </div>

            <div class="profile-table-shell live-question-table" role="table" aria-label="Recent question activity">
              <div class="profile-table-head" role="row">
                <span role="columnheader">Time</span>
                <span role="columnheader">Topic</span>
                <span role="columnheader">Question</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Confidence</span>
              </div>
              <div id="profileQuestionRows" class="profile-table-body">
                <p class="profile-empty-state" role="row">No question activity loaded yet.</p>
              </div>
            </div>
          </section>
        </section>
      `;
  }

  function renderReportsBlade() {
    return `
        <section class="reports-panel" aria-label="Reports">
          <div class="reports-header">
            <div>
              <h3>Reports</h3>
              <p>Review trends, standards coverage, and daily summaries.</p>
            </div>
          </div>

          <div class="reports-summary-grid" aria-label="Reports summary">
            <section class="report-summary-card">
              <span>Standards tagged</span>
              <strong id="reportStandardsTaggedValue">0</strong>
            </section>
            <section class="report-summary-card">
              <span>Untagged questions</span>
              <strong id="reportUntaggedQuestionsValue">0</strong>
            </section>
            <section class="report-summary-card">
              <span>Top topic</span>
              <strong id="reportTopTopicValue">-</strong>
            </section>
            <section class="report-summary-card attention">
              <span>Needs review</span>
              <strong id="reportNeedsReviewValue">0</strong>
            </section>
          </div>

          <div class="reports-content-grid">
            <section class="reports-card standards-coverage-card">
              <div class="reports-card-head">
                <div>
                  <h4>Standards Coverage</h4>
                  <span id="standardsSummaryStatus">No standards report loaded yet.</span>
                </div>
                <button type="button" id="profileRefreshStandardsReport" class="small-button secondary-small">Refresh Report</button>
              </div>

              <div class="standards-coverage-body">
                <div class="coverage-donut" id="standardsCoverageDonut" style="--coverage-percent: 0">
                  <strong id="standardsTaggedPercent">0%</strong>
                  <span>tagged</span>
                </div>
                <div class="standards-summary-counts" aria-label="Standards summary counts">
                  <div>
                    <span>Total questions</span>
                    <strong id="standardsTotalQuestions">0</strong>
                  </div>
                  <div>
                    <span>Tagged questions</span>
                    <strong id="standardsTaggedQuestions">0</strong>
                  </div>
                  <div>
                    <span>Untagged questions</span>
                    <strong id="standardsUntaggedQuestions">0</strong>
                  </div>
                  <div>
                    <span>Percentage tagged</span>
                    <strong id="standardsTaggedPercentValue">0%</strong>
                  </div>
                </div>
              </div>

              <div id="standardsSummaryEmptyState" class="profile-empty-state">No standards report loaded yet.</div>
            </section>

            <section class="reports-card topic-summary-card">
              <h4>Topic Summary</h4>
              <div id="profileTopicSummary" class="topic-summary-placeholder">
                <span class="topic-ring-placeholder" aria-hidden="true"></span>
                <p>Topic summary will appear here after question activity is available.</p>
              </div>
            </section>

            <section class="reports-card standards-report-card">
              <div class="profile-section-head standards-report-head">
                <div>
                  <h4>Top Standards / Concepts</h4>
                  <span id="standardsGeneratedAt">Not loaded</span>
                </div>
              </div>

              <div class="standards-report-table standards-table" role="table" aria-label="Top standards and concepts">
                <div class="standards-report-row standards-report-row-head" role="row">
                  <span role="columnheader">Rank</span>
                  <span role="columnheader">Standard / Concept</span>
                  <span role="columnheader">Count</span>
                  <span role="columnheader">% of Tagged</span>
                  <span role="columnheader">Examples</span>
                </div>
                <div id="standardsSummaryRows"></div>
              </div>
            </section>

            <section class="reports-card daily-email-card reports-email-card">
              <h4>Daily Email Report</h4>
              <span id="profileEmailNotice">Connect Gmail before sending daily reports.</span>
              <p id="profileDailySummaryText">Daily email reports summarize question topics and common student needs.</p>
              <button type="button" id="profileSendDailyEmail" class="small-button secondary-small" disabled>Send daily summary email</button>
            </section>
          </div>

          <div class="reports-hidden-metrics" aria-hidden="true">
            <span id="profileStandardsTaggedValue">0</span>
            <span id="standardsConfidenceStrong">0</span>
            <span id="standardsConfidenceMedium">0</span>
            <span id="standardsConfidenceWeak">0</span>
            <span id="standardsConfidenceNone">0</span>
            <div id="standardsConceptRows"></div>
            <div id="standardsUnitRows"></div>
            <div id="standardsRouteRows"></div>
            <div id="standardsRecentRows"></div>
          </div>
        </section>
      `;
  }

  // Hide placeholder blades until they are real tools. Future Phase 7B blades should be
  // added to bladeDefs, then included here when they are ready for teachers.
  const visibleBladeIds = ['main', 'live-activity', 'reports', 'ai-improvement', 'modes', 'system'];
  bladeDefs.splice(
    0,
    bladeDefs.length,
    ...visibleBladeIds.map((id) => bladeDefs.find((blade) => blade.id === id)).filter(Boolean)
  );

  const bladeRegistry = new Map();

  function registerBlades(blades) {
    bladeRegistry.clear();
    blades.forEach((blade, index) => {
      if (!blade?.id) return;
      blade.index = index;
      bladeRegistry.set(blade.id, blade);
    });
  }

  registerBlades(bladeDefs);

  function getBladeById(bladeId) {
    return bladeRegistry.get(String(bladeId || '')) || null;
  }

  function getBladeIndex(bladeId) {
    const blade = getBladeById(bladeId);
    return blade ? blade.index : -1;
  }

  function getCurrentBlade() {
    return bladeDefs[activeBladeIndex] || bladeDefs[getBladeIndex('main')] || bladeDefs[0] || null;
  }

  function getBladePosition(index) {
    if (index < activeBladeIndex) return 'left';
    if (index > activeBladeIndex) return 'right';
    return 'center';
  }

  function getStoredBladeId() {
    try {
      return localStorage.getItem(BLADE_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function storeBladeId(bladeId) {
    try {
      localStorage.setItem(BLADE_KEY, bladeId);
    } catch (_) {}
  }


  function getActiveIndex() {
    const saved = getStoredBladeId();
    const savedBladeId = saved === 'class-activity' ? 'live-activity' : saved;
    const idx = getBladeIndex(savedBladeId);
    if (idx >= 0) return idx;

    const mainIdx = getBladeIndex('main');
    return mainIdx >= 0 ? mainIdx : 0;
  }

  function setActiveIndex(idx) {
    if (!bladeDefs[idx]) return;
    storeBladeId(bladeDefs[idx].id);
  }

  let activeBladeIndex = getActiveIndex();
  let lastSwishTime = 0;
  let controlsBound = false;
  let keyboardBound = false;

  // CH_PHASE5_SAFE_SWISH_20260501
  function getBladeAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!playBladeSwish.ctx || playBladeSwish.ctx.state === 'closed') {
      playBladeSwish.ctx = new AudioContextClass();
    }

    return playBladeSwish.ctx;
  }

  function playBladeSwish(direction = 1) {
    try {
      if (localStorage.getItem('charlemagneBladeSound') === 'off') return;

      const nowMs = Date.now();
      if (nowMs - lastSwishTime < 180) return;
      lastSwishTime = nowMs;

      const ctx = getBladeAudioContext();
      if (!ctx) return;

      const startSound = () => startBladeSwish(ctx, direction);

      if (ctx.state === 'suspended') {
        const resumeResult = ctx.resume();
        if (resumeResult && typeof resumeResult.then === 'function') {
          resumeResult.then(startSound).catch(() => {});
        } else {
          startSound();
        }
        return;
      }

      startSound();
    } catch (_) {}
  }

  function startBladeSwish(ctx, direction = 1) {
    try {
      if (!ctx || ctx.state === 'closed') return;

      const now = ctx.currentTime;
      const duration = 0.18;
      const sampleRate = ctx.sampleRate || 44100;
      const buffer = ctx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i += 1) {
        const fadeIn = Math.min(1, i / (sampleRate * 0.018));
        const fadeOut = Math.min(1, (data.length - i) / (sampleRate * 0.075));
        data[i] = (Math.random() * 2 - 1) * 0.24 * fadeIn * fadeOut;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(direction >= 0 ? 760 : 1080, now);
      filter.frequency.exponentialRampToValueAtTime(direction >= 0 ? 1320 : 640, now + duration);
      filter.Q.setValueAtTime(0.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.028, now + 0.026);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      const tone = ctx.createOscillator();
      const toneGain = ctx.createGain();
      tone.type = 'sine';
      tone.frequency.setValueAtTime(direction >= 0 ? 360 : 420, now);
      tone.frequency.exponentialRampToValueAtTime(direction >= 0 ? 245 : 285, now + duration);
      toneGain.gain.setValueAtTime(0.0001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.006, now + 0.02);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      tone.connect(toneGain);
      toneGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + duration);
      tone.start(now);
      tone.stop(now + duration);

      window.setTimeout(() => {
        try {
          noise.disconnect();
          filter.disconnect();
          gain.disconnect();
          tone.disconnect();
          toneGain.disconnect();
        } catch (_) {}
      }, 320);
    } catch (_) {}
  }

  document.addEventListener('pointerdown', () => {
    try {
      const ctx = getBladeAudioContext();
      if (ctx && ctx.state === 'suspended') {
        const resumeResult = ctx.resume();
        if (resumeResult && typeof resumeResult.catch === 'function') resumeResult.catch(() => {});
      }
    } catch (_) {}
  }, { capture: true, passive: true });

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

    bladeDefs.forEach((blade, index) => {
      const page = document.createElement('section');
      page.className = 'blade-page';
      page.dataset.blade = blade.id;
      page.dataset.bladeIndex = String(index);
      page.dataset.bladePage = blade.id;
      page.dataset.bladePosition = 'right';

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
          data-blade="${blade.id}"
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
    const distance = Math.abs(index - activeIndex);
    btn.className = `blade-preview blade-preview-${side} ${side}`;
    btn.dataset.blade = blade.id;
    btn.dataset.bladeIndex = String(index);
    btn.dataset.bladePosition = side;
    btn.type = 'button';
    btn.setAttribute('aria-label', `Open ${blade.label} blade`);

    btn.style.setProperty('--preview-depth', String(distance));
    btn.style.setProperty('--preview-opacity', String(Math.max(0.42, 1 - distance * 0.14)));

    btn.innerHTML = `
      <div class="blade-preview-inner">
        <div class="blade-preview-title">${blade.short}</div>
        <div class="blade-preview-icon">${blade.icon}</div>
        <div class="blade-preview-accent ${blade.id}"></div>
      </div>
    `;
    return btn;
  }

  function setActiveBlade(nextIndex, options = {}) {
    const safeNext = Math.max(0, Math.min(bladeDefs.length - 1, Number(nextIndex)));
    if (Number.isNaN(safeNext) || safeNext === activeBladeIndex) return;

    const direction = safeNext > activeBladeIndex ? 1 : -1;
    activeBladeIndex = safeNext;

    if (options.sound !== false) {
      playBladeSwish(direction);
    }

    render(activeBladeIndex, direction);
  }

  function goToBlade(nextIndex, options = {}) {
    setActiveBlade(nextIndex, options);
  }

  function openBlade(bladeId, options = {}) {
    const index = getBladeIndex(bladeId === 'class-activity' ? 'live-activity' : bladeId);
    if (index < 0) return;
    setActiveBlade(index, options);
  }

  function closeBlade() {
    openBlade('main');
  }

  function toggleBlade(bladeId, options = {}) {
    const current = getCurrentBlade()?.id || '';
    openBlade(current === bladeId ? 'main' : bladeId, options);
  }

  function render(activeIndex, direction = 0) {
    if (!bladeDefs.length) return;

    activeBladeIndex = Math.max(0, Math.min(bladeDefs.length - 1, activeIndex));
    setActiveIndex(activeBladeIndex);
    const activeBlade = getCurrentBlade();
    const activeBladeId = activeBlade?.id || 'main';
    window.Charlemagne?.state?.set?.({ activeBlade: activeBladeId });

    const shell = document.getElementById('bladeUiShell');
    if (shell) {
      shell.dataset.activeBlade = activeBladeId;
      shell.dataset.activeBladeIndex = String(activeBladeIndex);
    }

    if (shell && direction !== 0) {
      shell.classList.remove('blade-move-left', 'blade-move-right');
      void shell.offsetWidth;
      shell.classList.add(direction > 0 ? 'blade-move-right' : 'blade-move-left');
      window.setTimeout(() => {
        shell.classList.remove('blade-move-left', 'blade-move-right');
      }, 360);
    }

    document.querySelectorAll('.blade-page[data-blade]').forEach((page) => {
      const pageIndex = Number(page.dataset.bladeIndex);
      const position = Number.isFinite(pageIndex) ? getBladePosition(pageIndex) : 'right';
      page.dataset.bladePosition = position;
      page.classList.toggle('active', position === 'center');
      page.classList.toggle('blade-page-left', position === 'left');
      page.classList.toggle('blade-page-right', position === 'right');
    });

    const leftRail = document.getElementById('bladeLeftRail');
    const rightRail = document.getElementById('bladeRightRail');
    if (leftRail) leftRail.innerHTML = '';
    if (rightRail) rightRail.innerHTML = '';

    const leftItems = bladeDefs
      .map((blade, idx) => ({ blade, idx }))
      .filter((item) => item.idx < activeBladeIndex);

    const rightItems = bladeDefs
      .map((blade, idx) => ({ blade, idx }))
      .filter((item) => item.idx > activeBladeIndex);

    leftItems.forEach((item) => {
      leftRail?.appendChild(makePreviewBlade(item.blade, item.idx, activeBladeIndex, 'left'));
    });

    rightItems.forEach((item) => {
      rightRail?.appendChild(makePreviewBlade(item.blade, item.idx, activeBladeIndex, 'right'));
    });

    buildBottomNav(activeBladeIndex);

    document.dispatchEvent(new CustomEvent('charlemagne:blade-active', {
      detail: {
        id: activeBladeId,
        index: activeBladeIndex,
        label: activeBlade?.label || ''
      }
    }));
  }

  function handleBladeControl(event) {
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;

    const control = target.closest('button[data-blade], a[data-blade], [role="button"][data-blade], [data-blade-toggle], [data-blade-close], [data-blade-shift], .blade-arrow-left, .blade-arrow-right');
    if (!control || !document.getElementById('bladeUiShell')?.contains(control)) return;

    if (control.matches('[data-blade-close]')) {
      event.preventDefault();
      closeBlade();
      return;
    }

    if (control.matches('[data-blade-toggle]')) {
      event.preventDefault();
      toggleBlade(control.dataset.bladeToggle);
      return;
    }

    if (control.matches('[data-blade-shift]')) {
      event.preventDefault();
      const shift = Number(control.dataset.bladeShift);
      if (!Number.isNaN(shift)) setActiveBlade(activeBladeIndex + shift);
      return;
    }

    if (control.matches('.blade-arrow-left')) {
      event.preventDefault();
      setActiveBlade(activeBladeIndex - 1);
      return;
    }

    if (control.matches('.blade-arrow-right')) {
      event.preventDefault();
      setActiveBlade(activeBladeIndex + 1);
      return;
    }

    if (control.matches('button[data-blade], a[data-blade], [role="button"][data-blade]')) {
      event.preventDefault();
      openBlade(control.dataset.blade);
    }
  }

  function bindBladeControls(shell) {
    if (!shell || controlsBound) return;
    controlsBound = true;
    shell.addEventListener('click', handleBladeControl);
  }

  function bindKeyboardControls() {
    if (keyboardBound) return;
    keyboardBound = true;

    document.addEventListener('keydown', (event) => {
      if (!document.getElementById('bladeUiShell')) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveBlade(activeBladeIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveBlade(activeBladeIndex + 1);
      }
    });
  }

  function initBladeUi() {
    if (document.getElementById('bladeUiShell')) return;

    const appRoot =
      document.querySelector('.app-shell') ||
      document.querySelector('main') ||
      document.querySelector('.container') ||
      document.querySelector('.page-shell') ||
      document.body.firstElementChild;

    if (!appRoot) return;

    buildShell(appRoot);
    bindBladeControls(document.getElementById('bladeUiShell'));
    bindKeyboardControls();
    render(activeBladeIndex, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBladeUi);
  } else {
    initBladeUi();
  }

  window.Charlemagne = window.Charlemagne || {};
  window.Charlemagne.blades = {
    close: closeBlade,
    current: () => ({ ...(getCurrentBlade() || {}) }),
    goTo: openBlade,
    init: initBladeUi,
    list: () => bladeDefs.map((blade) => ({ ...blade })),
    open: openBlade,
    registry: Object.fromEntries(bladeDefs.map((blade) => [blade.id, { ...blade }])),
    toggle: toggleBlade
  };
})();
