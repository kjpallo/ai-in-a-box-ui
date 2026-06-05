(() => {
  const MODULE_SCRIPTS = [
    '/teacher-content/constants.js',
    '/teacher-content/state.js',
    '/teacher-content/utils.js',
    '/teacher-content/api.js',
    '/teacher-content/upload-queue.js',
    '/teacher-content/render-upload.js',
    '/teacher-content/render-review.js',
    '/teacher-content/render-approved.js',
    '/teacher-content/review-actions.js',
    '/teacher-content/overlay.js',
    '/teacher-content/tabs.js',
    '/teacher-content/status.js',
    '/teacher-content/standards-panel.js',
    '/teacher-content/upload-controller.js',
    '/teacher-content/review-controller.js',
    '/teacher-content/approved-controller.js',
    '/teacher-content/index.js'
  ];

  const BOOT_KEY = '__charlemagneTeacherContentLoader';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-teacher-content-module="${src}"]`);
      if (existing) {
        if (existing.getAttribute('data-loaded') === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.setAttribute('data-teacher-content-module', src);
      script.addEventListener('load', () => {
        script.setAttribute('data-loaded', 'true');
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  if (!window[BOOT_KEY]) {
    window[BOOT_KEY] = MODULE_SCRIPTS.reduce((promise, src) => {
      return promise.then(() => loadScript(src));
    }, Promise.resolve()).catch((error) => {
      if (typeof console !== 'undefined' && typeof console.error === 'function') {
        console.error('[TeacherContentUI] Failed to load teacher-content modules.', error);
      }
    });
  }
})();
