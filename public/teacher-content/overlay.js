(() => {
  const ns = (window.CharlemagneTeacherContent = window.CharlemagneTeacherContent || {});

  function createOverlayModule(deps = {}) {
    const {
      state,
      byId,
      render,
      loadTeacherContent
    } = deps;

    function buildOverlay() {
      if (byId('teacherContentOverlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'teacherContentOverlay';
      overlay.className = 'teacher-content-overlay';
      overlay.hidden = true;
      overlay.innerHTML = `
        <div class="teacher-content-scrim" data-teacher-content-close></div>
        <section class="teacher-content-blade" role="dialog" aria-modal="true" aria-labelledby="teacherContentTitle">
          <div class="teacher-content-head">
            <div>
              <span class="profile-status-pill">Teacher Content</span>
              <h3 id="teacherContentTitle">Create New Knowledge</h3>
              <p>Upload and review draft content before publishing student-ready knowledge packs.</p>
            </div>
            <button type="button" id="teacherContentClose" class="teacher-content-close" aria-label="Close Teacher Content" data-teacher-content-close>×</button>
          </div>

          <div class="teacher-content-status-row">
            <span id="teacherContentLoadStatus">Ready to load teacher content.</span>
            <span>Import workflow: Upload, then Review.</span>
          </div>

          <nav id="teacherContentTabs" class="teacher-content-tabs" aria-label="Teacher Content cards"></nav>
          <div id="teacherContentDeck" class="teacher-content-deck"></div>

          <div class="teacher-content-footer">
            <button type="button" id="teacherContentBack" class="small-button secondary-small">Back</button>
            <span id="teacherContentStepLabel">Upload</span>
            <button type="button" id="teacherContentNext" class="small-button">Next</button>
          </div>
        </section>
      `;

      document.body.appendChild(overlay);
    }

    async function openOverlay() {
      const overlay = byId('teacherContentOverlay');
      if (!overlay) return;

      overlay.hidden = false;
      document.body.classList.add('teacher-content-open');
      byId('teacherContentClose')?.focus();

      if (!state.loadedOnce) {
        await loadTeacherContent();
      } else {
        render();
      }
    }

    function closeOverlay() {
      const overlay = byId('teacherContentOverlay');
      if (!overlay) return;
      overlay.hidden = true;
      document.body.classList.remove('teacher-content-open');
      byId('openTeacherContentOverlay')?.focus();
    }

    function isOverlayOpen() {
      const overlay = byId('teacherContentOverlay');
      return Boolean(overlay && !overlay.hidden);
    }

    function watchForManagerShell() {
      if (state.managerObserver || byId('teacherContentKnowledgeManager') || typeof MutationObserver !== 'function') return;
      const observer = new MutationObserver(() => {
        if (!byId('teacherContentKnowledgeManager')) return;
        observer.disconnect();
        state.managerObserver = null;
        render();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      state.managerObserver = observer;
    }

    return {
      buildOverlay,
      openOverlay,
      closeOverlay,
      isOverlayOpen,
      watchForManagerShell
    };
  }

  ns.createOverlayModule = createOverlayModule;
})();
